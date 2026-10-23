# Short-node acceptance measurements

Five sequential alternating trial pairs; uninstrumented clean-built artifacts. Median [min-max], milliseconds. Full output arrays match the frozen baseline engine reference. Cold1000 recorded but not gated. No p95/significance claim.

| Scenario | Baseline completion | Candidate completion | Reduction | Drift change | Gate |
|---|---:|---:|---:|---:|---|
| mmseg/unique/manual-cold-1000 | 319.8 [252.0-437.8] | 345.1 [253.0-452.6] | -7.9% | 8.0ms | not gated |
| mmseg/unique/manual-warm-20000 | 3603.3 [2067.2-4233.9] | 896.8 [561.8-986.7] | 75.1% | -24.5ms | PASS |
| mmseg/unique/auto-dynamic-1000-roots | 2189.7 [1663.6-3097.2] | 74.2 [61.7-87.1] | 96.6% | -5.3ms | PASS |
| mmseg/repeated/manual-cold-1000 | 348.7 [271.9-1093.8] | 303.2 [234.9-558.8] | 13.0% | 1.1ms | not gated |
| mmseg/repeated/manual-warm-20000 | 4050.1 [2011.6-4679.5] | 339.6 [198.3-525.5] | 91.6% | -26.5ms | PASS |
| mmseg/repeated/auto-dynamic-1000-roots | 2499.5 [2296.0-3695.7] | 42.3 [39.6-44.7] | 98.3% | -2.3ms | PASS |
| jieba/unique/manual-cold-1000 | 3026.6 [1878.3-3087.8] | 1834.3 [1099.2-2420.0] | 39.4% | 10.9ms | not gated |
| jieba/unique/manual-warm-20000 | 4621.7 [4070.6-5652.4] | 941.8 [932.6-1507.3] | 79.6% | -1.2ms | PASS |
| jieba/unique/auto-dynamic-1000-roots | 2837.1 [2429.1-3816.5] | 67.9 [64.5-68.6] | 97.6% | -9.3ms | PASS |
| jieba/repeated/manual-cold-1000 | 2581.1 [1449.8-3405.7] | 2777.3 [1210.4-3658.3] | -7.6% | 13.2ms | not gated |
| jieba/repeated/manual-warm-20000 | 4277.9 [3484.7-4351.1] | 468.4 [345.1-496.2] | 89.1% | 0.8ms | PASS |
| jieba/repeated/auto-dynamic-1000-roots | 3269.3 [1997.0-3778.2] | 47.6 [35.1-72.0] | 98.5% | -10.3ms | PASS |

Overall acceptance: PASS. Required each of8cells: candidate median completion <=50% ofbaseline; median oftrial maximum timerdrift <=baseline+10ms. SeeREADME.md for workload/method limitations.
