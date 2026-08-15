//! Runs the frozen, shared oracle at
//! `conformance/canonical-identity-json-conformance-v0/vectors.json`
//! (included directly from the repo, not copied) against the independent
//! Rust comparator in `src/lib.rs`.

use serde_json::Value as Json;
use tsei_canonical_identity_rust_v0::{canonicalize, canonical_identity_json, MutantMode, Value};

const VECTORS_JSON: &str =
    include_str!("../../../conformance/canonical-identity-json-conformance-v0/vectors.json");

fn json_to_value(j: &Json) -> Value {
    match j {
        Json::Null => Value::Null,
        Json::Bool(b) => Value::Bool(*b),
        Json::Number(n) => Value::Number(n.as_f64().expect("vector numbers fit in f64")),
        Json::String(s) => Value::String(s.clone()),
        Json::Array(items) => Value::Array(items.iter().map(json_to_value).collect()),
        Json::Object(map) => Value::Object(
            map.iter()
                .map(|(k, v)| (k.clone(), json_to_value(v)))
                .collect(),
        ),
    }
}

/// Resolves a vector's `plain`/`plain_kind` field pair (e.g. `left`/`left_kind`,
/// `value`/`value_kind`) into a `Value`, per `format_notes` in vectors.json.
fn resolve(obj: &serde_json::Map<String, Json>, plain_key: &str, kind_key: &str) -> Value {
    if let Some(kind) = obj.get(kind_key).and_then(Json::as_str) {
        return match kind {
            "positive_zero" => Value::Number(0.0_f64),
            "negative_zero" => Value::Number(-0.0_f64),
            "nan" => Value::Number(f64::NAN),
            "positive_infinity" => Value::Number(f64::INFINITY),
            "negative_infinity" => Value::Number(f64::NEG_INFINITY),
            "undefined" => Value::Undefined,
            "object_with_one_undefined_valued_key" => {
                let base = obj
                    .get("value")
                    .and_then(Json::as_object)
                    .expect("object_with_one_undefined_valued_key carries a base `value` object");
                let value_key = obj
                    .get("value_key")
                    .and_then(Json::as_str)
                    .expect("object_with_one_undefined_valued_key carries `value_key`");
                let mut entries: Vec<(String, Value)> = base
                    .iter()
                    .map(|(k, v)| (k.clone(), json_to_value(v)))
                    .collect();
                entries.push((value_key.to_string(), Value::Undefined));
                Value::Object(entries)
            }
            other => panic!("unrecognized *_kind marker in vectors.json: {other}"),
        };
    }
    let plain = obj
        .get(plain_key)
        .unwrap_or_else(|| panic!("vector missing both `{plain_key}` and `{kind_key}`"));
    json_to_value(plain)
}

struct LoadedVectors {
    root: Json,
}

fn load() -> LoadedVectors {
    let root: Json = serde_json::from_str(VECTORS_JSON).expect("vectors.json must parse as JSON");
    assert_eq!(
        root.get("schema").and_then(Json::as_str),
        Some("receiptos.canonical_identity_json_conformance_vectors.v0"),
        "unexpected vectors.json schema id -- oracle file may have changed shape"
    );
    LoadedVectors { root }
}

fn run_all_vectors(mutant: MutantMode) -> Vec<(String, bool)> {
    let loaded = load();
    let vectors = loaded.root["vectors"].as_array().expect("vectors array");
    let mut results = Vec::with_capacity(vectors.len());

    for v in vectors {
        let obj = v.as_object().expect("each vector is an object");
        let id = obj["vector_id"].as_str().expect("vector_id").to_string();
        let category = obj["category"].as_str().expect("category");

        let ok = match category {
            "equal_pair" => {
                let left = resolve(obj, "left", "left_kind");
                let right = resolve(obj, "right", "right_kind");
                match (canonicalize(&left, mutant), canonicalize(&right, mutant)) {
                    (Ok(l), Ok(r)) => l == r,
                    _ => false,
                }
            }
            "not_equal_pair" => {
                let left = resolve(obj, "left", "left_kind");
                let right = resolve(obj, "right", "right_kind");
                match (canonicalize(&left, mutant), canonicalize(&right, mutant)) {
                    (Ok(l), Ok(r)) => l != r,
                    _ => false,
                }
            }
            "canonical_form" => {
                let value = resolve(obj, "value", "value_kind");
                let expected = obj["expected_canonical"].as_str().expect("expected_canonical");
                matches!(canonicalize(&value, mutant), Ok(got) if got == expected)
            }
            "throws" => {
                let value = resolve(obj, "value", "value_kind");
                canonicalize(&value, mutant).is_err()
            }
            other => panic!("unrecognized vector category: {other}"),
        };

        results.push((id, ok));
    }

    results
}

#[test]
fn all_24_vectors_pass_under_the_real_comparator() {
    let results = run_all_vectors(MutantMode::None);
    let failures: Vec<&String> = results.iter().filter(|(_, ok)| !ok).map(|(id, _)| id).collect();
    assert!(
        failures.is_empty(),
        "vectors failed under the real (non-mutant) comparator: {failures:?}"
    );
    assert_eq!(results.len(), 24, "expected exactly 24 frozen vectors");
}

#[test]
fn repeatability_same_corpus_run_twice_is_identical() {
    let first: Vec<(String, Option<String>)> = corpus_canonical_forms(MutantMode::None);
    let second: Vec<(String, Option<String>)> = corpus_canonical_forms(MutantMode::None);
    assert_eq!(first, second, "canonicalization is not deterministically repeatable");
}

fn corpus_canonical_forms(mutant: MutantMode) -> Vec<(String, Option<String>)> {
    let loaded = load();
    let vectors = loaded.root["vectors"].as_array().expect("vectors array");
    vectors
        .iter()
        .map(|v| {
            let obj = v.as_object().expect("vector object");
            let id = obj["vector_id"].as_str().unwrap().to_string();
            let category = obj["category"].as_str().unwrap();
            let value = match category {
                "canonical_form" | "throws" => resolve(obj, "value", "value_kind"),
                _ => resolve(obj, "left", "left_kind"),
            };
            (id, canonicalize(&value, mutant).ok())
        })
        .collect()
}

/// For each of the four described mutants, prove the frozen corpus actually
/// discriminates it: running the *mutant* comparator variant against the
/// vector(s) it is documented to wrongly collapse must produce a collapse
/// (left/right canonicalize equal) where the real comparator (proven above)
/// produces not-equal. This is mutation-testing evidence, not just "24/24
/// pass" -- it shows the corpus would actually catch each described bug.
#[test]
fn all_four_mutants_are_caught_by_the_corpus() {
    let loaded = load();
    let mutants = loaded.root["mutants"].as_array().expect("mutants array");
    assert_eq!(mutants.len(), 4, "expected exactly 4 documented mutants");

    let vectors = loaded.root["vectors"].as_array().expect("vectors array");
    let find_vector = |id: &str| -> &serde_json::Map<String, Json> {
        vectors
            .iter()
            .find(|v| v["vector_id"].as_str() == Some(id))
            .unwrap_or_else(|| panic!("mutant references unknown vector_id {id}"))
            .as_object()
            .unwrap()
    };

    for m in mutants {
        let mutant_id = m["mutant_id"].as_str().expect("mutant_id");
        let mode = match mutant_id {
            "sort_arrays_as_sets" => MutantMode::SortArraysAsSets,
            "drop_null_valued_fields" => MutantMode::DropNullValuedFields,
            "lowercase_strings" => MutantMode::LowercaseStrings,
            "coerce_numeric_strings_to_numbers" => MutantMode::CoerceNumericStringsToNumbers,
            other => panic!("unrecognized mutant_id: {other}"),
        };

        let targets = m["wrongly_collapses_vector_ids"]
            .as_array()
            .expect("wrongly_collapses_vector_ids");
        assert!(!targets.is_empty(), "mutant {mutant_id} names no target vectors");

        for target in targets {
            let vid = target.as_str().expect("vector id string");
            let obj = find_vector(vid);
            assert_eq!(
                obj["category"].as_str(),
                Some("not_equal_pair"),
                "mutant target vector {vid} must be a not_equal_pair vector"
            );

            let left = resolve(obj, "left", "left_kind");
            let right = resolve(obj, "right", "right_kind");

            // The real comparator must keep these distinct.
            let real_left = canonical_identity_json(&left).expect("real comparator succeeds");
            let real_right = canonical_identity_json(&right).expect("real comparator succeeds");
            assert_ne!(
                real_left, real_right,
                "real comparator wrongly collapses {vid} -- corpus/implementation mismatch"
            );

            // The mutant must collapse them (that's what makes it a mutant
            // this corpus can catch).
            let mutant_left = canonicalize(&left, mode).expect("mutant path succeeds");
            let mutant_right = canonicalize(&right, mode).expect("mutant path succeeds");
            assert_eq!(
                mutant_left, mutant_right,
                "mutant {mutant_id} was expected to collapse {vid} but did not \
                 -- corpus would fail to catch this mutant"
            );
        }
    }
}
