//! Prints a human-readable conformance summary against the frozen vector
//! corpus. Run with `cargo run --bin conformance_report`.

use serde_json::Value as Json;
use tsei_canonical_identity_rust_v0::{canonicalize, canonical_identity_json, MutantMode, Value};

const VECTORS_JSON: &str =
    include_str!("../../../../conformance/canonical-identity-json-conformance-v0/vectors.json");

fn json_to_value(j: &Json) -> Value {
    match j {
        Json::Null => Value::Null,
        Json::Bool(b) => Value::Bool(*b),
        Json::Number(n) => Value::Number(n.as_f64().unwrap()),
        Json::String(s) => Value::String(s.clone()),
        Json::Array(items) => Value::Array(items.iter().map(json_to_value).collect()),
        Json::Object(map) => {
            Value::Object(map.iter().map(|(k, v)| (k.clone(), json_to_value(v))).collect())
        }
    }
}

fn resolve(obj: &serde_json::Map<String, Json>, plain_key: &str, kind_key: &str) -> Value {
    if let Some(kind) = obj.get(kind_key).and_then(Json::as_str) {
        return match kind {
            "positive_zero" => Value::Number(0.0_f64),
            "negative_zero" => Value::Number(-0.0_f64),
            "nan" => Value::Number(f64::NAN),
            "positive_infinity" => Value::Number(f64::INFINITY),
            "negative_infinity" => Value::Number(f64::NEG_INFINITY),
            "undefined" => Value::Undefined,
            "lone_high_surrogate_string" | "lone_low_surrogate_string" => {
                Value::InvalidUnicodeString
            }
            "object_with_one_undefined_valued_key" => {
                let base = obj.get("value").and_then(Json::as_object).unwrap();
                let value_key = obj.get("value_key").and_then(Json::as_str).unwrap();
                let mut entries: Vec<(String, Value)> =
                    base.iter().map(|(k, v)| (k.clone(), json_to_value(v))).collect();
                entries.push((value_key.to_string(), Value::Undefined));
                Value::Object(entries)
            }
            other => panic!("unrecognized *_kind marker: {other}"),
        };
    }
    json_to_value(obj.get(plain_key).unwrap())
}

fn main() {
    let root: Json = serde_json::from_str(VECTORS_JSON).expect("vectors.json parses");
    let vectors = root["vectors"].as_array().unwrap();
    let mutants = root["mutants"].as_array().unwrap();

    let mut equal_pair = 0usize;
    let mut not_equal_pair = 0usize;
    let mut canonical_form = 0usize;
    let mut throws = 0usize;
    let mut failures: Vec<String> = Vec::new();

    for v in vectors {
        let obj = v.as_object().unwrap();
        let id = obj["vector_id"].as_str().unwrap();
        let category = obj["category"].as_str().unwrap();

        let ok = match category {
            "equal_pair" => {
                equal_pair += 1;
                let l = resolve(obj, "left", "left_kind");
                let r = resolve(obj, "right", "right_kind");
                matches!((canonical_identity_json(&l), canonical_identity_json(&r)), (Ok(a), Ok(b)) if a == b)
            }
            "not_equal_pair" => {
                not_equal_pair += 1;
                let l = resolve(obj, "left", "left_kind");
                let r = resolve(obj, "right", "right_kind");
                matches!((canonical_identity_json(&l), canonical_identity_json(&r)), (Ok(a), Ok(b)) if a != b)
            }
            "canonical_form" => {
                canonical_form += 1;
                let val = resolve(obj, "value", "value_kind");
                let expected = obj["expected_canonical"].as_str().unwrap();
                matches!(canonical_identity_json(&val), Ok(got) if got == expected)
            }
            "throws" => {
                throws += 1;
                let val = resolve(obj, "value", "value_kind");
                canonical_identity_json(&val).is_err()
            }
            other => panic!("unrecognized category {other}"),
        };

        if !ok {
            failures.push(id.to_string());
        }
    }

    let mut mutants_detected = 0usize;
    for m in mutants {
        let mutant_id = m["mutant_id"].as_str().unwrap();
        let mode = match mutant_id {
            "sort_arrays_as_sets" => MutantMode::SortArraysAsSets,
            "drop_null_valued_fields" => MutantMode::DropNullValuedFields,
            "lowercase_strings" => MutantMode::LowercaseStrings,
            "coerce_numeric_strings_to_numbers" => MutantMode::CoerceNumericStringsToNumbers,
            other => panic!("unrecognized mutant_id {other}"),
        };
        let targets = m["wrongly_collapses_vector_ids"].as_array().unwrap();
        let all_caught = targets.iter().all(|t| {
            let vid = t.as_str().unwrap();
            let obj = vectors
                .iter()
                .find(|v| v["vector_id"].as_str() == Some(vid))
                .unwrap()
                .as_object()
                .unwrap();
            let l = resolve(obj, "left", "left_kind");
            let r = resolve(obj, "right", "right_kind");
            let mutant_l = canonicalize(&l, mode).unwrap();
            let mutant_r = canonicalize(&r, mode).unwrap();
            mutant_l == mutant_r
        });
        if all_caught {
            mutants_detected += 1;
        } else {
            eprintln!("mutant NOT caught by corpus: {mutant_id}");
        }
    }

    println!("TSEI canonical-identity Rust comparator -- conformance report");
    println!("vectors total:        {}", vectors.len());
    println!("  equal_pair:         {equal_pair}");
    println!("  not_equal_pair:     {not_equal_pair}");
    println!("  canonical_form:     {canonical_form}");
    println!("  throws:             {throws}");
    println!("vectors passed:       {}/{}", vectors.len() - failures.len(), vectors.len());
    if !failures.is_empty() {
        println!("FAILURES: {failures:?}");
    }
    println!("mutants detected:     {mutants_detected}/{}", mutants.len());
}
