"""Independent probability and likelihood checks. Requires numpy and scipy."""
import json
import math
import pathlib
import subprocess
import numpy as np
from scipy.special import logsumexp
from scipy.stats import binom, binomtest

root = pathlib.Path(__file__).resolve().parent.parent
data = json.loads(subprocess.check_output(['node', str(root / 'tests/reference-fixtures.cjs')], text=True))
views = {'annual': (12, 1), 'quarterly': (3, 4), 'monthly': (1, 12), 'rolling': (12, 1)}
for case in data['models']:
    N, p = case['N'], case['p']
    q = p / 12
    mu = N * p
    sd_annual = math.sqrt(12 * N * q * (1-q))
    for key, (months, scale) in views.items():
        n = months * N
        sd = scale * math.sqrt(n*q*(1-q))
        actual = case['views'][key]
        assert abs(actual['sd'] - sd/N*100) < 1e-10
        for field, width in [('own', sd), ('shared', sd_annual)]:
            low, high = (mu-2*width)/scale, (mu+2*width)/scale
            expected = binom.cdf(math.ceil(low)-1, n, q) + binom.sf(math.floor(high), n, q)
            assert abs(actual[field]-expected) < 2e-8, (case, key, field, expected)

errors = []
for case in data['likelihoods']:
    N, p = case['N'], case['p']
    counts = np.array(case['counts'])
    # Independent fine midpoint integration of likelihood ratios. Binomial
    # coefficients cancel; use total suffix exits and exposure directly.
    delta = .25 + .35 * (np.arange(4096) + .5) / 4096
    alternatives = np.concatenate((np.minimum(.95,p*(1+delta)), np.maximum(.005,p*(1-delta))))/12
    q0 = p/12
    terms = []
    for month in range(7,19):
        suffix = counts[month-1:]
        successes = suffix.sum()
        failures = len(suffix)*N-successes
        terms.extend(successes*np.log(alternatives/q0) + failures*np.log((1-alternatives)/(1-q0)))
    expected = logsumexp(terms)-math.log(len(terms))
    error = abs(case['logBF']-expected)
    errors.append(error)
    assert np.isfinite(case['logBF'])
    # Error may grow for overwhelming evidence; near-threshold accuracy is
    # separately checked and the model is explicitly an approximation.
    assert error < .05, (case, expected, error)
    assert (case['logBF'] > 0) == (expected > 0), (case, expected)
    if abs(expected) < 1:
        assert error < .002, (case, expected, error)
for index, successes in enumerate([0,50,100]):
    reference = binomtest(successes,100).proportion_ci(method='wilson')
    assert np.allclose(data['intervals'][index], [reference.low,reference.high], atol=1e-12)
assert data['intervals'][3] == [None,None]
print(f'PASS: {len(data["models"])*4} independent SciPy view checks; {len(errors)} continuous-prior likelihood checks; Wilson interval boundary checks. Maximum |log BF error|: {max(errors):.6g}.')
