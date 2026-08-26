//! Independent, clean-room Rust implementation of the canonical-identity JSON
//! comparator described normatively in Section 11 of
//! `docs/TRANSFORMATION_STABLE_EVIDENCE_INTEROPERABILITY_V0.md`.
//!
//! This crate was built from that specification document and the frozen
//! vector corpus at
//! `conformance/canonical-identity-json-conformance-v0/vectors.json` only.
//! It does not read, import, link against, or transpile the TypeScript
//! reference implementation. The vector corpus is treated strictly as an
//! oracle for expected outcomes, never as a design source.
//!
//! Numeric canonicalization reproduces the public ECMA-262 `Number::toString`
//! (radix 10) algorithm, derived from the published ECMAScript specification
//! text (not from any project source file), since Section 11 pins the
//! comparator's numeric literal form to "this specification's reference
//! numeric-to-string behavior" and the vector corpus's `1e21` / `1e-7`
//! canonical-form vectors are consistent with that public algorithm.

use std::fmt;

/// A JSON-shaped value, extended with a JS-`undefined` analog.
///
/// Plain JSON has no way to express "the key is present but its value is
/// undefined" or "the top-level value itself is undefined" -- both cases the
/// spec's comparator requirements (Section 11, "absent-value rejection")
/// require rejecting, distinctly from the key/value being entirely omitted.
/// `Value::Undefined` is that explicit, structural stand-in.
#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Null,
    Bool(bool),
    Number(f64),
    String(String),
    Array(Vec<Value>),
    /// Insertion order is preserved on construction; the comparator sorts by
    /// key internally, so the field order here must not affect the result
    /// (see the object-insertion-order-independence tests).
    Object(Vec<(String, Value)>),
    Undefined,
    /// Structural stand-in for a string that is not a Unicode scalar-value
    /// sequence (for example, a lone UTF-16 surrogate). Rust `String` cannot
    /// represent such an input directly.
    InvalidUnicodeString,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CanonicalizeError {
    NonFiniteNumber,
    UndefinedValue,
    InvalidUnicodeScalarSequence,
}

impl fmt::Display for CanonicalizeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CanonicalizeError::NonFiniteNumber => {
                write!(f, "canonicalIdentityJson: non-finite number rejected")
            }
            CanonicalizeError::UndefinedValue => {
                write!(f, "canonicalIdentityJson: undefined value rejected")
            }
            CanonicalizeError::InvalidUnicodeScalarSequence => {
                write!(f, "canonicalIdentityJson: invalid Unicode scalar sequence rejected")
            }
        }
    }
}

impl std::error::Error for CanonicalizeError {}

/// Which single bug this call should reproduce, or none (the correct
/// implementation). Used only by the mutant-discrimination harness; real
/// callers always use [`canonical_identity_json`], which is
/// `canonicalize(value, MutantMode::None)`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MutantMode {
    /// The correct, spec-conforming behavior.
    None,
    /// "Recursively sorts and dedupes arrays as if they were sets before
    /// canonicalizing, instead of preserving declared order and duplicates."
    SortArraysAsSets,
    /// "Silently omits any object key whose value is null before
    /// canonicalizing, instead of treating null as a present value."
    DropNullValuedFields,
    /// "Lowercases every string value before canonicalizing, instead of
    /// preserving case exactly."
    LowercaseStrings,
    /// "Treats a string that parses as a finite number as if it were that
    /// number, instead of keeping numbers and strings in strictly separate
    /// canonical forms."
    CoerceNumericStringsToNumbers,
}

/// The canonical-identity comparator (Section 11). Two values are
/// preservation-identical iff this returns `Ok` with equal strings for both.
pub fn canonical_identity_json(value: &Value) -> Result<String, CanonicalizeError> {
    canonicalize(value, MutantMode::None)
}

/// Same comparator, but deliberately reproducing one described bug. Exists
/// only to prove the frozen vector corpus actually discriminates each bug
/// (mutation-testing evidence), never used by real callers.
pub fn canonicalize(value: &Value, mutant: MutantMode) -> Result<String, CanonicalizeError> {
    match value {
        Value::Undefined => Err(CanonicalizeError::UndefinedValue),
        Value::InvalidUnicodeString => Err(CanonicalizeError::InvalidUnicodeScalarSequence),
        Value::Null => Ok("null".to_string()),
        Value::Bool(b) => Ok(if *b { "true".to_string() } else { "false".to_string() }),
        Value::Number(n) => canonicalize_number(*n),
        Value::String(s) => canonicalize_string(s, mutant),
        Value::Array(items) => canonicalize_array(items, mutant),
        Value::Object(entries) => canonicalize_object(entries, mutant),
    }
}

fn canonicalize_array(items: &[Value], mutant: MutantMode) -> Result<String, CanonicalizeError> {
    let mut rendered: Vec<String> = Vec::with_capacity(items.len());
    for item in items {
        rendered.push(canonicalize(item, mutant)?);
    }

    if mutant == MutantMode::SortArraysAsSets {
        rendered.sort();
        rendered.dedup();
    }

    Ok(format!("[{}]", rendered.join(",")))
}

fn canonicalize_object(
    entries: &[(String, Value)],
    mutant: MutantMode,
) -> Result<String, CanonicalizeError> {
    let mut rendered: Vec<(String, String, String)> = Vec::with_capacity(entries.len());
    for (key, val) in entries {
        if mutant == MutantMode::DropNullValuedFields && matches!(val, Value::Null) {
            continue;
        }
        let rendered_val = canonicalize(val, mutant)?;
        let rendered_key = canonicalize_string(key, MutantMode::None)?;
        rendered.push((key.clone(), rendered_key, rendered_val));
    }

    // Rust strings are valid Unicode scalar-value sequences, and UTF-8 byte
    // order preserves Unicode scalar order. Sort the raw key, never its JSON-
    // escaped rendering (Section 11).
    rendered.sort_by(|a, b| a.0.cmp(&b.0));

    let joined = rendered
        .into_iter()
        .map(|(_, k, v)| format!("{}:{}", k, v))
        .collect::<Vec<_>>()
        .join(",");
    Ok(format!("{{{}}}", joined))
}

fn canonicalize_string(s: &str, mutant: MutantMode) -> Result<String, CanonicalizeError> {
    if mutant == MutantMode::CoerceNumericStringsToNumbers {
        if let Ok(n) = s.parse::<f64>() {
            if n.is_finite() {
                return canonicalize_number(n);
            }
        }
    }

    let effective: std::borrow::Cow<str> = if mutant == MutantMode::LowercaseStrings {
        std::borrow::Cow::Owned(s.to_lowercase())
    } else {
        std::borrow::Cow::Borrowed(s)
    };

    Ok(quote_json_string(&effective))
}

/// Minimal JSON string quoting: escapes `"` and `\`, escapes control
/// characters (using the short forms where JSON defines one, `\u00XX`
/// otherwise), and leaves everything else -- including `/` and all non-ASCII
/// codepoints -- untouched. No case folding, no Unicode normalization
/// (Section 11: "no Unicode normalization... string case significant").
fn quote_json_string(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{0008}' => out.push_str("\\b"),
            '\u{000C}' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

/// ECMA-262 `Number::toString(x, 10)`, restricted to finite doubles (the
/// comparator rejects non-finite numbers outright per Section 11).
///
/// Derived directly from the published ECMAScript algorithm text: obtain the
/// shortest decimal digit string `s` (length `k`) and decimal-point position
/// `n` such that the value equals `s * 10^(n-k)`, then place the digits
/// according to the spec's four placement rules. Rust's `{:e}` formatter
/// already produces the shortest round-trip decimal digit string for `f64`
/// (same "shortest correctly-rounded" contract the ECMAScript algorithm
/// requires), so it supplies `s`/`n` here; only the placement/exponent-format
/// logic below is spec-specific.
fn canonicalize_number(x: f64) -> Result<String, CanonicalizeError> {
    if !x.is_finite() {
        return Err(CanonicalizeError::NonFiniteNumber);
    }
    if x == 0.0 {
        // +0 and -0 both canonicalize to "0" (vectors:
        // positive_zero_canonical_form, negative_zero_canonical_form).
        return Ok("0".to_string());
    }
    if x < 0.0 {
        return Ok(format!("-{}", format_positive_finite(-x)));
    }
    Ok(format_positive_finite(x))
}

fn format_positive_finite(x: f64) -> String {
    debug_assert!(x > 0.0 && x.is_finite());

    let sci = format!("{:e}", x);
    let (mantissa, exp_str) = sci.split_once('e').expect("LowerExp always emits 'e'");
    let exp: i64 = exp_str.parse().expect("LowerExp exponent is a plain integer");

    let digits: String = mantissa.chars().filter(|c| *c != '.').collect();
    let k = digits.len() as i64;
    let n = exp + 1;

    if n >= k && n <= 21 {
        // Rule a: integer, no decimal point, pad with (n-k) trailing zeros.
        let mut out = digits;
        out.push_str(&"0".repeat((n - k) as usize));
        out
    } else if n > 0 && n <= 21 {
        // Rule b: decimal point after the n-th digit.
        let (int_part, frac_part) = digits.split_at(n as usize);
        format!("{}.{}", int_part, frac_part)
    } else if n > -6 && n <= 0 {
        // Rule c: "0." + (-n) leading zeros + digits.
        format!("0.{}{}", "0".repeat((-n) as usize), digits)
    } else {
        // Rule d: exponential notation.
        let (first, rest) = digits.split_at(1);
        let mantissa_part = if rest.is_empty() {
            first.to_string()
        } else {
            format!("{}.{}", first, rest)
        };
        let exponent_value = n - 1;
        let sign = if exponent_value >= 0 { "+" } else { "-" };
        format!("{}e{}{}", mantissa_part, sign, exponent_value.abs())
    }
}

#[cfg(test)]
mod unit_tests {
    use super::*;

    #[test]
    fn zero_and_negative_zero_canonicalize_to_zero() {
        assert_eq!(canonical_identity_json(&Value::Number(0.0)).unwrap(), "0");
        assert_eq!(canonical_identity_json(&Value::Number(-0.0)).unwrap(), "0");
    }

    #[test]
    fn large_and_small_exponentials() {
        assert_eq!(canonical_identity_json(&Value::Number(1e21)).unwrap(), "1e+21");
        assert_eq!(canonical_identity_json(&Value::Number(1e-7)).unwrap(), "1e-7");
    }

    #[test]
    fn boundary_placement_sanity() {
        assert_eq!(canonical_identity_json(&Value::Number(100.0)).unwrap(), "100");
        assert_eq!(canonical_identity_json(&Value::Number(123.456)).unwrap(), "123.456");
        assert_eq!(canonical_identity_json(&Value::Number(0.5)).unwrap(), "0.5");
        assert_eq!(canonical_identity_json(&Value::Number(1.0)).unwrap(), "1");
        assert_eq!(canonical_identity_json(&Value::Number(-42.0)).unwrap(), "-42");
        assert_eq!(canonical_identity_json(&Value::Number(1e20)).unwrap(), "100000000000000000000");
        assert_eq!(canonical_identity_json(&Value::Number(1e-6)).unwrap(), "0.000001");
    }

    #[test]
    fn non_finite_numbers_rejected() {
        assert!(canonical_identity_json(&Value::Number(f64::NAN)).is_err());
        assert!(canonical_identity_json(&Value::Number(f64::INFINITY)).is_err());
        assert!(canonical_identity_json(&Value::Number(f64::NEG_INFINITY)).is_err());
    }

    #[test]
    fn undefined_rejected_top_level_and_nested() {
        assert!(canonical_identity_json(&Value::Undefined).is_err());
        let obj = Value::Object(vec![("a".to_string(), Value::Undefined)]);
        assert!(canonical_identity_json(&obj).is_err());
    }

    #[test]
    fn object_insertion_order_independence_supplementary() {
        // Supplementary to the frozen corpus's own two order-independence
        // vectors: exercises every permutation of a four-key object.
        let base = vec![
            ("a".to_string(), Value::Number(1.0)),
            ("b".to_string(), Value::Bool(true)),
            ("c".to_string(), Value::Null),
            ("d".to_string(), Value::String("x".to_string())),
        ];
        let expected = canonical_identity_json(&Value::Object(base.clone())).unwrap();

        let mut indices = [0usize, 1, 2, 3];
        let mut permutations: Vec<[usize; 4]> = Vec::new();
        permute(&mut indices, 0, &mut permutations);

        for perm in permutations {
            let reordered: Vec<(String, Value)> = perm.iter().map(|&i| base[i].clone()).collect();
            let got = canonical_identity_json(&Value::Object(reordered)).unwrap();
            assert_eq!(got, expected);
        }
    }

    fn permute(arr: &mut [usize; 4], k: usize, out: &mut Vec<[usize; 4]>) {
        if k == arr.len() {
            out.push(*arr);
            return;
        }
        for i in k..arr.len() {
            arr.swap(k, i);
            permute(arr, k + 1, out);
            arr.swap(k, i);
        }
    }
}
