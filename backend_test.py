#!/usr/bin/env python3
"""
UCIP Backend API Test Suite
Tests all new endpoints for the University Competitor Intelligence Platform
"""
import requests
import json
import time
from typing import Dict, Any, Optional

# Base URL from environment
BASE_URL = "https://rival-track-2.preview.emergentagent.com/api"
ADMIN_EMAIL = "muneesh.kumar@lpu.co.in"

# Global token storage
auth_token: Optional[str] = None

def print_test_header(test_name: str):
    """Print a formatted test header"""
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_result(success: bool, message: str, details: Any = None):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if details:
        print(f"Details: {json.dumps(details, indent=2, default=str)[:500]}")

def test_auth_flow() -> bool:
    """Test 1: Auth flow - request OTP and verify"""
    global auth_token
    
    print_test_header("1. Authentication Flow (OTP)")
    
    try:
        # Step 1: Request OTP
        print("\n[1.1] POST /api/auth/request-otp")
        response = requests.post(
            f"{BASE_URL}/auth/request-otp",
            json={"email": ADMIN_EMAIL},
            timeout=10
        )
        
        if response.status_code != 200:
            print_result(False, f"Request OTP failed with status {response.status_code}", response.text)
            return False
        
        data = response.json()
        if not data.get("ok"):
            print_result(False, "Request OTP response missing 'ok: true'", data)
            return False
        
        dev_otp = data.get("devOtp")
        if not dev_otp:
            print_result(False, "devOtp not found in response (dev mode)", data)
            return False
        
        print_result(True, f"OTP requested successfully, devOtp: {dev_otp}")
        
        # Step 2: Verify OTP
        print("\n[1.2] POST /api/auth/verify-otp")
        response = requests.post(
            f"{BASE_URL}/auth/verify-otp",
            json={"email": ADMIN_EMAIL, "otp": dev_otp},
            timeout=10
        )
        
        if response.status_code != 200:
            print_result(False, f"Verify OTP failed with status {response.status_code}", response.text)
            return False
        
        data = response.json()
        if not data.get("ok") or not data.get("token"):
            print_result(False, "Verify OTP response missing 'ok' or 'token'", data)
            return False
        
        auth_token = data["token"]
        user = data.get("user", {})
        
        if user.get("role") != "admin":
            print_result(False, f"User role is '{user.get('role')}', expected 'admin'", user)
            return False
        
        print_result(True, f"OTP verified, token obtained, user role: {user.get('role')}")
        return True
        
    except Exception as e:
        print_result(False, f"Auth flow exception: {str(e)}")
        return False

def test_dashboard_unauthorized() -> bool:
    """Test 2: Dashboard without auth should return 401"""
    print_test_header("2. Dashboard Unauthorized Access")
    
    try:
        response = requests.get(f"{BASE_URL}/dashboard", timeout=10)
        
        if response.status_code == 401:
            print_result(True, "Dashboard correctly returns 401 without auth")
            return True
        else:
            print_result(False, f"Expected 401, got {response.status_code}", response.text[:200])
            return False
            
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_seed_baseline() -> bool:
    """Test 3: POST /api/admin/seed-baseline"""
    print_test_header("3. Seed Baseline (Admin)")
    
    if not auth_token:
        print_result(False, "No auth token available")
        return False
    
    try:
        print("\n[3.1] POST /api/admin/seed-baseline")
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/admin/seed-baseline",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=60
        )
        elapsed = time.time() - start_time
        
        if response.status_code != 200:
            print_result(False, f"Seed baseline failed with status {response.status_code}", response.text[:300])
            return False
        
        data = response.json()
        
        # Validate response shape
        if not data.get("ok"):
            print_result(False, "Response missing 'ok: true'", data)
            return False
        
        summary = data.get("summary", [])
        if not isinstance(summary, list):
            print_result(False, "Summary is not a list", data)
            return False
        
        if len(summary) != 8:
            print_result(False, f"Expected 8 universities in summary, got {len(summary)}", summary)
            return False
        
        # Check total changes
        total_changes = sum(item.get("changesCreated", 0) for item in summary)
        if total_changes <= 100:
            print_result(False, f"Expected >100 total changes, got {total_changes}", summary)
            return False
        
        print_result(True, f"Baseline seeded: {len(summary)} universities, {total_changes} total changes, took {elapsed:.1f}s")
        print(f"Summary sample: {json.dumps(summary[:2], indent=2)}")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_dashboard() -> bool:
    """Test 4: GET /api/dashboard"""
    print_test_header("4. Dashboard (Authenticated)")
    
    if not auth_token:
        print_result(False, "No auth token available")
        return False
    
    try:
        response = requests.get(
            f"{BASE_URL}/dashboard",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=15
        )
        
        if response.status_code != 200:
            print_result(False, f"Dashboard failed with status {response.status_code}", response.text[:300])
            return False
        
        data = response.json()
        
        # Validate structure
        stats = data.get("stats", {})
        universities = data.get("universities", [])
        recent_changes = data.get("recentChanges", [])
        
        # Check stats
        if stats.get("totalChanges", 0) <= 0:
            print_result(False, f"stats.totalChanges is {stats.get('totalChanges')}, expected >0", stats)
            return False
        
        if stats.get("totalSnapshots", 0) < 16:
            print_result(False, f"stats.totalSnapshots is {stats.get('totalSnapshots')}, expected ≥16", stats)
            return False
        
        # Check universities
        if len(universities) != 8:
            print_result(False, f"Expected 8 universities, got {len(universities)}", universities)
            return False
        
        # Check recent changes
        if len(recent_changes) == 0:
            print_result(False, "recentChanges is empty", data)
            return False
        
        print_result(True, f"Dashboard OK: {stats.get('totalChanges')} changes, {stats.get('totalSnapshots')} snapshots, {len(universities)} unis, {len(recent_changes)} recent changes")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_changes() -> bool:
    """Test 5: GET /api/changes?sinceHours=24&limit=100"""
    print_test_header("5. Get Changes")
    
    if not auth_token:
        print_result(False, "No auth token available")
        return False
    
    try:
        response = requests.get(
            f"{BASE_URL}/changes?sinceHours=24&limit=100",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        if response.status_code != 200:
            print_result(False, f"Changes failed with status {response.status_code}", response.text[:300])
            return False
        
        changes = response.json()
        
        if not isinstance(changes, list):
            print_result(False, "Response is not a list", changes)
            return False
        
        if len(changes) == 0:
            print_result(False, "Changes list is empty", changes)
            return False
        
        # Validate first change structure
        first = changes[0]
        required_fields = ["id", "universityCode", "type", "severity", "detectedAt", "pageUrl"]
        missing = [f for f in required_fields if f not in first]
        
        if missing:
            print_result(False, f"Missing fields in change: {missing}", first)
            return False
        
        print_result(True, f"Changes OK: {len(changes)} changes found")
        print(f"Sample change: {json.dumps(first, indent=2, default=str)[:400]}")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_daily_intel() -> bool:
    """Test 6: POST /api/ai/daily-intel?force=1"""
    print_test_header("6. Generate Daily Intel (AI)")
    
    if not auth_token:
        print_result(False, "No auth token available")
        return False
    
    try:
        print("\n[6.1] POST /api/ai/daily-intel?force=1 (may take 20-45s)")
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/ai/daily-intel?force=1",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=60
        )
        elapsed = time.time() - start_time
        
        if response.status_code != 200:
            print_result(False, f"Daily intel failed with status {response.status_code}", response.text[:300])
            return False
        
        data = response.json()
        
        # Validate structure
        if not data.get("id"):
            print_result(False, "Missing 'id' field", data)
            return False
        
        intel = data.get("intel", {})
        if not intel:
            print_result(False, "Missing 'intel' object", data)
            return False
        
        # Check required intel fields
        required = ["headline", "competitiveMoves", "todayForLpu", "riskSignals", "opportunities"]
        missing = [f for f in required if f not in intel]
        if missing:
            print_result(False, f"Missing intel fields: {missing}", intel.keys())
            return False
        
        # Validate todayForLpu length
        today_for_lpu = intel.get("todayForLpu", [])
        if not isinstance(today_for_lpu, list) or len(today_for_lpu) != 3:
            print_result(False, f"todayForLpu should be array of length 3, got {len(today_for_lpu)}", today_for_lpu)
            return False
        
        # Check basedOnChanges
        based_on = data.get("basedOnChanges", 0)
        if based_on <= 0:
            print_result(False, f"basedOnChanges is {based_on}, expected >0", data)
            return False
        
        print_result(True, f"Daily intel generated in {elapsed:.1f}s, based on {based_on} changes")
        print(f"Headline: {intel.get('headline', '')[:100]}")
        print(f"Competitive moves: {len(intel.get('competitiveMoves', []))}")
        print(f"Today for LPU: {len(today_for_lpu)} actions")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_daily_intel_latest() -> bool:
    """Test 7: GET /api/ai/daily-intel/latest"""
    print_test_header("7. Get Latest Daily Intel")
    
    if not auth_token:
        print_result(False, "No auth token available")
        return False
    
    try:
        response = requests.get(
            f"{BASE_URL}/ai/daily-intel/latest",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        if response.status_code != 200:
            print_result(False, f"Latest intel failed with status {response.status_code}", response.text[:300])
            return False
        
        data = response.json()
        
        if not data or not data.get("id"):
            print_result(False, "No daily intel document found", data)
            return False
        
        intel = data.get("intel", {})
        if not intel.get("headline"):
            print_result(False, "Intel missing headline", intel)
            return False
        
        print_result(True, f"Latest intel retrieved: {data.get('id')}")
        print(f"Created at: {data.get('createdAt')}")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_compare() -> bool:
    """Test 8: GET /api/compare?aId=&bId="""
    print_test_header("8. Compare Universities")
    
    if not auth_token:
        print_result(False, "No auth token available")
        return False
    
    try:
        # First get universities to get IDs
        print("\n[8.1] GET /api/universities")
        response = requests.get(
            f"{BASE_URL}/universities",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        if response.status_code != 200:
            print_result(False, f"Universities failed with status {response.status_code}", response.text[:300])
            return False
        
        unis = response.json()
        if len(unis) < 2:
            print_result(False, f"Need at least 2 universities, got {len(unis)}", unis)
            return False
        
        # Find LPU and a competitor
        lpu = next((u for u in unis if u.get("code") == "LPU"), None)
        competitor = next((u for u in unis if u.get("code") != "LPU"), None)
        
        if not lpu or not competitor:
            print_result(False, "Could not find LPU or competitor", unis)
            return False
        
        lpu_id = lpu.get("id")
        comp_id = competitor.get("id")
        
        print(f"Comparing LPU ({lpu_id}) vs {competitor.get('name')} ({comp_id})")
        
        # Now compare
        print("\n[8.2] GET /api/compare")
        response = requests.get(
            f"{BASE_URL}/compare?aId={lpu_id}&bId={comp_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        if response.status_code != 200:
            print_result(False, f"Compare failed with status {response.status_code}", response.text[:300])
            return False
        
        data = response.json()
        
        # Validate structure
        a = data.get("a", {})
        b = data.get("b", {})
        
        if not a or not b:
            print_result(False, "Missing 'a' or 'b' in response", data)
            return False
        
        # Check snapshots
        a_snapshot = a.get("snapshot", {})
        b_snapshot = b.get("snapshot", {})
        
        if not a_snapshot or not b_snapshot:
            print_result(False, "Missing snapshots", {"a": a_snapshot, "b": b_snapshot})
            return False
        
        # Check SEO titles
        a_title = a_snapshot.get("data", {}).get("seo", {}).get("title")
        b_title = b_snapshot.get("data", {}).get("seo", {}).get("title")
        
        if not a_title or not b_title:
            print_result(False, "Missing SEO titles", {"a_title": a_title, "b_title": b_title})
            return False
        
        print_result(True, f"Compare OK: {a.get('university', {}).get('name')} vs {b.get('university', {}).get('name')}")
        print(f"A title: {a_title[:80]}")
        print(f"B title: {b_title[:80]}")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_pagespeed_all() -> bool:
    """Test 9: GET /api/pagespeed/all?strategy=mobile"""
    print_test_header("9. PageSpeed All Universities")
    
    if not auth_token:
        print_result(False, "No auth token available")
        return False
    
    try:
        response = requests.get(
            f"{BASE_URL}/pagespeed/all?strategy=mobile",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=15
        )
        
        if response.status_code != 200:
            print_result(False, f"PageSpeed all failed with status {response.status_code}", response.text[:300])
            return False
        
        data = response.json()
        
        # Validate structure
        strategy = data.get("strategy")
        results = data.get("results", [])
        
        if strategy != "mobile":
            print_result(False, f"Expected strategy 'mobile', got '{strategy}'", data)
            return False
        
        if len(results) != 8:
            print_result(False, f"Expected 8 results, got {len(results)}", results)
            return False
        
        # Check each result has university
        for r in results:
            if not r.get("university"):
                print_result(False, "Result missing 'university' field", r)
                return False
        
        # Count how many have pagespeed data
        with_ps = sum(1 for r in results if r.get("pagespeed") is not None)
        
        print_result(True, f"PageSpeed all OK: {len(results)} universities, {with_ps} with cached data")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_pagespeed_single() -> bool:
    """Test 10: GET /api/pagespeed?url=...&strategy=mobile (with caching)"""
    print_test_header("10. PageSpeed Single URL (with caching)")
    
    if not auth_token:
        print_result(False, "No auth token available")
        return False
    
    try:
        test_url = "https://www.stanford.edu"
        
        # First call - should fetch from API
        print(f"\n[10.1] First call for {test_url} (may take 20-40s)")
        start_time = time.time()
        response = requests.get(
            f"{BASE_URL}/pagespeed?url={test_url}&strategy=mobile",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=60
        )
        elapsed1 = time.time() - start_time
        
        if response.status_code != 200:
            print_result(False, f"PageSpeed failed with status {response.status_code}", response.text[:300])
            return False
        
        data1 = response.json()
        
        # Validate structure
        scores = data1.get("scores", {})
        cwv = data1.get("coreWebVitals", {})
        
        required_scores = ["performance", "seo", "accessibility", "bestPractices"]
        missing_scores = [s for s in required_scores if s not in scores]
        if missing_scores:
            print_result(False, f"Missing scores: {missing_scores}", scores)
            return False
        
        # Check scores are 0-100
        for key, val in scores.items():
            if not isinstance(val, int) or val < 0 or val > 100:
                print_result(False, f"Score {key} is {val}, expected int 0-100", scores)
                return False
        
        if not cwv:
            print_result(False, "Missing coreWebVitals", data1)
            return False
        
        cached1 = data1.get("cached", False)
        
        print_result(True, f"First call OK in {elapsed1:.1f}s, cached={cached1}")
        print(f"Scores: perf={scores.get('performance')}, seo={scores.get('seo')}, a11y={scores.get('accessibility')}, bp={scores.get('bestPractices')}")
        
        # Second call - should be cached
        print(f"\n[10.2] Second call for {test_url} (should be cached)")
        start_time = time.time()
        response = requests.get(
            f"{BASE_URL}/pagespeed?url={test_url}&strategy=mobile",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        elapsed2 = time.time() - start_time
        
        if response.status_code != 200:
            print_result(False, f"Second PageSpeed call failed with status {response.status_code}", response.text[:300])
            return False
        
        data2 = response.json()
        cached2 = data2.get("cached", False)
        
        if not cached2:
            print_result(False, f"Second call should be cached but cached={cached2}", data2)
            return False
        
        if elapsed2 > 5:
            print_result(False, f"Cached call took {elapsed2:.1f}s, expected <5s", data2)
            return False
        
        print_result(True, f"Second call OK in {elapsed2:.1f}s, cached={cached2}")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("UCIP BACKEND API TEST SUITE")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Admin Email: {ADMIN_EMAIL}")
    
    results = {}
    
    # Run tests in order
    results["1. Auth Flow"] = test_auth_flow()
    results["2. Dashboard Unauthorized"] = test_dashboard_unauthorized()
    results["3. Seed Baseline"] = test_seed_baseline()
    results["4. Dashboard"] = test_dashboard()
    results["5. Changes"] = test_changes()
    results["6. Daily Intel"] = test_daily_intel()
    results["7. Daily Intel Latest"] = test_daily_intel_latest()
    results["8. Compare"] = test_compare()
    results["9. PageSpeed All"] = test_pagespeed_all()
    results["10. PageSpeed Single"] = test_pagespeed_single()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\n{'='*80}")
    print(f"TOTAL: {passed}/{total} tests passed")
    print(f"{'='*80}\n")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
