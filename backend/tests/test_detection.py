"""
Unit tests for the detection pipeline.

Tests baseline computation, z-score logic, feature extraction,
and the detection engine blending.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'app'))

import pytest
import numpy as np
import pandas as pd
from baseline import build_user_baselines, zscore, NUMERIC_FEATURES, BASELINE_TRAIN_DAYS
from model import rule_based_score_and_reasons, severity_from_score, train_isolation_forest


# ── Fixtures ───────────────────────────────────────────────────────────────

@pytest.fixture
def sample_feature_df():
    """Create a small feature DataFrame for testing."""
    rows = []
    for day in range(30):
        rows.append({
            "user_id": "user001",
            "date": f"2026-05-{day+1:02d}",
            "department": "Engineering",
            "avg_login_hour": 9.0 + np.random.normal(0, 0.5),
            "earliest_login_hour": 8.5 + np.random.normal(0, 0.3),
            "after_hours_login": 0,
            "failed_logins": 0,
            "login_count": 1,
            "distinct_ips": 1,
            "files_accessed": int(np.random.poisson(15)),
            "sensitive_files_accessed": int(np.random.poisson(2)),
            "files_downloaded": int(np.random.poisson(5)),
            "usb_events": 0,
            "usb_first_time": 0,
            "usb_data_mb": 0.0,
            "transfer_mb": np.random.exponential(30),
            "external_transfer_mb": np.random.exponential(5),
        })
    # Add one anomalous day
    rows.append({
        "user_id": "user001",
        "date": "2026-06-01",
        "department": "Engineering",
        "avg_login_hour": 2.5,
        "earliest_login_hour": 2.5,
        "after_hours_login": 1,
        "failed_logins": 3,
        "login_count": 2,
        "distinct_ips": 3,
        "files_accessed": 80,
        "sensitive_files_accessed": 40,
        "files_downloaded": 60,
        "usb_events": 1,
        "usb_first_time": 1,
        "usb_data_mb": 500.0,
        "transfer_mb": 1500.0,
        "external_transfer_mb": 1500.0,
    })
    return pd.DataFrame(rows)


# ── Baseline Tests ─────────────────────────────────────────────────────────

class TestBehavioralBaseline:
    def test_build_user_baselines_returns_dict(self, sample_feature_df):
        baselines = build_user_baselines(sample_feature_df)
        assert "user001" in baselines
        assert "features" in baselines["user001"]
        assert "baseline_ready" in baselines["user001"]

    def test_baseline_contains_expected_features(self, sample_feature_df):
        baselines = build_user_baselines(sample_feature_df)
        features = baselines["user001"]["features"]
        for feat in NUMERIC_FEATURES:
            assert feat in features, f"Missing feature: {feat}"
            assert "mean" in features[feat]
            assert "std" in features[feat]
            assert "max" in features[feat]

    def test_baseline_std_has_floor(self, sample_feature_df):
        """Near-zero variance features should have a minimum std."""
        baselines = build_user_baselines(sample_feature_df)
        usb_std = baselines["user001"]["features"]["usb_first_time"]["std"]
        assert usb_std >= 0.5, f"USB std should have floor >= 0.5, got {usb_std}"

    def test_baseline_ready_after_min_days(self):
        """User with > 10 days should have baseline_ready=True."""
        from baseline import BASELINE_MIN_DAYS
        df = pd.DataFrame([
            {"user_id": "user001", "date": f"2026-05-{d+1:02d}",
             **{f: 0 for f in NUMERIC_FEATURES}}
            for d in range(BASELINE_MIN_DAYS + 1)
        ])
        baselines = build_user_baselines(df)
        assert baselines["user001"]["baseline_ready"] == True


# ── Z-Score Tests ──────────────────────────────────────────────────────────

class TestZScore:
    def test_zscore_normal(self):
        score = zscore(10, 5, 2)
        assert score == 2.5, f"Expected 2.5, got {score}"

    def test_zscore_zero(self):
        score = zscore(5, 5, 2)
        assert score == 0.0

    def test_zscore_negative(self):
        score = zscore(0, 5, 2)
        assert score == -2.5

    def test_zscore_nan_value(self):
        score = zscore(float('nan'), 5, 2)
        assert score == 0.0

    def test_zscore_none_value(self):
        score = zscore(None, 5, 2)
        assert score == 0.0


# ── Rule-Based Scoring Tests ────────────────────────────────────────────────

class TestRuleBasedScoring:
    def test_normal_day_triggers_no_rules(self, sample_feature_df):
        baselines = build_user_baselines(sample_feature_df)
        normal_row = sample_feature_df.iloc[0]
        score, reasons = rule_based_score_and_reasons(normal_row, baselines["user001"])
        # Normal day should have few or no reasons
        assert len(reasons) < 3

    def test_anomalous_day_triggers_rules(self, sample_feature_df):
        baselines = build_user_baselines(sample_feature_df)
        anomaly_row = sample_feature_df.iloc[-1]  # Last row is anomalous
        score, reasons = rule_based_score_and_reasons(anomaly_row, baselines["user001"])
        assert len(reasons) > 0, "Anomalous day should trigger rules"
        assert score > 0, "Anomalous day should have non-zero score"

    def test_reasons_have_explanations(self, sample_feature_df):
        baselines = build_user_baselines(sample_feature_df)
        anomaly_row = sample_feature_df.iloc[-1]
        score, reasons = rule_based_score_and_reasons(anomaly_row, baselines["user001"])
        for reason in reasons:
            assert "explanation" in reason
            assert "feature" in reason
            assert "contribution" in reason


# ── Severity Tests ─────────────────────────────────────────────────────────

class TestSeverity:
    def test_critical_threshold(self):
        assert severity_from_score(85, True) == "Critical"
        assert severity_from_score(80, True) == "Critical"

    def test_high_threshold(self):
        assert severity_from_score(70, True) == "High"
        assert severity_from_score(60, True) == "High"

    def test_medium_threshold(self):
        assert severity_from_score(50, True) == "Medium"
        assert severity_from_score(40, True) == "Medium"

    def test_low_threshold(self):
        assert severity_from_score(30, True) == "Low"

    def test_not_baseline_ready_is_low(self):
        assert severity_from_score(85, False) == "Low"


# ── Isolation Forest Tests ─────────────────────────────────────────────────

class TestIsolationForest:
    def test_if_returns_scores(self, sample_feature_df):
        model, scores = train_isolation_forest(sample_feature_df)
        assert len(scores) == len(sample_feature_df)
        assert all(0 <= s <= 100 for s in scores), "Scores should be 0-100"

    def test_if_higher_score_more_anomalous(self, sample_feature_df):
        model, scores = train_isolation_forest(sample_feature_df)
        # Last row (anomalous) should have higher score than first row (normal)
        assert scores[-1] > scores[0], "Anomalous day should have higher IF score"
