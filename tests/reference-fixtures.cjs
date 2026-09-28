'use strict';
// Production outputs to compare against SciPy, with no duplicated production math.
const m = require('./model-loader.cjs');
const parameters = [[1000,.1],[50,.02],[50,.04],[50,.13],[50,.4],[10000,.02],[10000,.4],[200,.23]];
const models = parameters.map(([N,p]) => {
  const x = m.createModel(N,p);
  return {N,p,views:Object.fromEntries(Object.entries(x.views).map(([key,v]) => [key, {
    own:v.pOutOwn,shared:v.pOutShared,sd:v.sdU/N*100
  }]))};
});
const cases = [
  {N:1000,p:.1,counts:Array(24).fill(8)},
  {N:1000,p:.1,counts:[...Array(6).fill(8),...Array(18).fill(13)]},
  {N:1000,p:.1,counts:[...Array(17).fill(8),...Array(7).fill(4)]},
  {N:50,p:.02,counts:Array.from({length:24},(_,i)=>i%7===0?1:0)},
  {N:10000,p:.4,counts:[...Array(6).fill(333),...Array(18).fill(500)]}
];
const rng=m.seededRng(6192);
let nearest;
for(let i=0;i<200;i++){
  const counts=m.makeRound(1000,.1,rng).X.slice(12);
  const logBF=m.idealLogBF(counts,m.idealTables(1000,.1,Math.max(...counts),64));
  if(!nearest||Math.abs(logBF)<Math.abs(nearest.logBF))nearest={N:1000,p:.1,counts,logBF};
}
cases.push(nearest);
const likelihoods=cases.map(x=>({...x,logBF:m.idealLogBF(x.counts,m.idealTables(x.N,x.p,Math.max(...x.counts),64))}));
console.log(JSON.stringify({models,likelihoods,intervals:[m.wilson(0,100),m.wilson(50,100),m.wilson(100,100),m.wilson(0,0)]}));
