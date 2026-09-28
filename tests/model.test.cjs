const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('./model-loader.cjs');
const baseline = Array.from({length:12},(_,i)=>i%2?100:0);
const result = (base,test,N=12) => M.xmrOf([...base,...test],N);

test('R1 strict rational limits, exact boundary ties and headcount invariance',()=>{
  const x=result(baseline,[316,50,50,50]);
  assert.equal(x.m,50); assert.equal(x.mr,100); assert.equal(x.U,316); assert.equal(x.Hu,183);
  assert.equal(x.r1[0],false); assert.equal(result(baseline,[317]).r1[0],true);
  assert.equal(result(baseline,[183,183,183,50]).events.some(e=>e.rule==='r2'),false);
  assert.equal(result(baseline,[184,184,184,50]).events.some(e=>e.rule==='r2'),true);
  const counts=[...baseline,183,184,316,317,0,0,0,0,0,0,0,0];
  for(const N of [50,100,750,1000,10000]) assert.deepEqual(M.xmrOf(counts,N).events,M.xmrOf(counts,12).events);
});
test('R1 central ties never create runs; 7 versus 8 strictly one-sided points',()=>{
  const base=Array.from({length:12},(_,i)=>i%2?9:7);
  assert.deepEqual(result(base,Array(24).fill(8),50).events,[]);
  assert.equal(result(base,Array(7).fill(9)).events.some(e=>e.rule==='r3'),false);
  assert.equal(result(base,Array(8).fill(9)).events.some(e=>e.rule==='r3'),true);
  assert.equal(result(base,[...Array(7).fill(9),8,9]).events.some(e=>e.rule==='r3'),false);
});
test('R1/R2 zero moving range is unavailable, retained only for oracle/human denominators',()=>{
  for(const value of [0,1,20]){
    const x=result(Array(12).fill(value),Array(24).fill(value),50);
    assert.equal(x.evaluable,false);assert.equal(x.r1.filter(Boolean).length,0);assert.deepEqual(x.events,[]);
    for(const k of ['m','mr','U','L'])assert.ok(Number.isFinite(x[k]));
  }
  const b=M.createBenchmark(50,.1);b.add({X:Array(36).fill(1),change:null});
  b.add({X:Array(36).fill(1),change:{month:7,from:.1,to:.15}});
  const r=b.result();assert.equal(r.degenerate,2);assert.equal(r.metrics.fa1.denominator,0);assert.equal(r.metrics.miA.rate,null);
  assert.equal(r.metrics.faI.denominator,1);assert.equal(r.metrics.miI.denominator,1);
});
test('R2 event index is test month minus one and prechange classification differs from detection',()=>{
  const change={month:10};
  assert.deepEqual(M.summarizeEvents([{j:2,rule:'r1'}],change),{any:true,prechange:true,detected:false,noPostSignal:true,delay:null});
  assert.equal(M.summarizeEvents([{j:9,rule:'r1'}],change).delay,0);
  assert.equal(M.summarizeEvents([{j:12,rule:'r2'}],change).delay,3);
  assert.equal(M.summarizeEvents([{j:8,rule:'r1'},{j:12,rule:'r2'}],change).prechange,true);
});
test('R4 approximate oracle is finite with configurable continuous-prior quadrature',()=>{
  const counts=Array(24).fill(8);
  const a=M.idealLogBF(counts,M.idealTables(1000,.1,0,64));
  const b=M.idealLogBF(counts,M.idealTables(1000,.1,0,2048));
  assert.ok(Number.isFinite(a));assert.ok(Math.abs(a-b)<.002);
  assert.equal(M.idealFor(counts,1000,.1),a>0);
});
test('R5 seed reproducibility, interactive randomness isolation, batch size independence',()=>{
  const expected=M.longRun(1000,.1,200,987);
  const b=M.createBenchmark(1000,.1,987);
  for(let start=0;start<200;start+=17){for(let i=start;i<Math.min(start+17,200);i++)b.step();M.makeRound(50,.2);}
  assert.deepEqual(b.result(),expected);
  assert.notDeepEqual(M.longRun(1000,.1,200,988),expected);
  assert.equal(expected.metrics.fa1.denominator,expected.evaluableStable);
  assert.equal(expected.detection.combined.detected+expected.detection.combined.postChangeNoSignal.numerator,expected.evaluableChanged);
});
test('R5 Wilson intervals handle all-zero, all-one and empty denominators',()=>{
  assert.deepEqual(M.wilson(0,0),[null,null]);
  assert.equal(M.wilson(0,10)[0],0);assert.equal(M.wilson(10,10)[1],1);
  assert.ok(Math.abs(M.wilson(0,10)[1]-.2775328)<1e-6);
  assert.ok(Math.abs(M.wilson(5,10)[0]-.2365931)<1e-6);
});
function scheduler(){let time=0,id=0;const queue=new Map();return {now:()=>time,advance:n=>time+=n,schedule:fn=>{queue.set(++id,fn);return id;},unschedule:id=>queue.delete(id),run(){const entry=queue.entries().next().value;if(!entry)return false;queue.delete(entry[0]);entry[1]();return true;},get pending(){return queue.size;}};}
test('R6 scheduler yields at budget, cancellation prevents stale progress/done and replacement completes',()=>{
  const clock=scheduler();let work=0,done=0,progress=[];
  const options={...clock,now:clock.now,schedule:clock.schedule,unschedule:clock.unschedule,total:10,budget:8,step:()=>{work++;clock.advance(3);},progress:n=>progress.push(n),done:()=>done++};
  const first=M.createBudgetJob(options);assert.equal(work,0);clock.run();assert.equal(work,3);assert.deepEqual(progress,[3]);
  first.cancel();while(clock.run()){}assert.equal(work,3);assert.equal(done,0);
  const second=M.createBudgetJob(options);while(clock.run()){}assert.equal(second.completed,10);assert.equal(work,13);assert.equal(done,1);
  assert.deepEqual(progress,[3,3,6,9,10]);assert.equal(clock.pending,0);
});
test('R6 cancellation inside progress callback never schedules more work',()=>{
  const clock=scheduler();let work=0,job;
  job=M.createBudgetJob({...clock,total:10,step:()=>{work++;clock.advance(8);},progress:()=>job.cancel(),done:()=>assert.fail('cancelled job completed')});
  clock.run();assert.equal(work,1);assert.equal(clock.pending,0);
});
test('R6 max-setting benchmark units make progress without heavy preprocessing',()=>{
  const start=performance.now(),b=M.createBenchmark(10000,.4,20260928),setup=performance.now()-start;
  let max=0;for(let i=0;i<100;i++){const t=performance.now();b.step();max=Math.max(max,performance.now()-t);}
  assert.equal(b.result().rounds,100);
  console.log(`Max-setting timing diagnostic: initialization ${setup.toFixed(2)} ms; maximum single round ${max.toFixed(2)} ms (runtime-dependent, not a hard real-time guarantee).`);
});

test('R6 cancellation in final progress callback suppresses done',()=>{
  const clock=scheduler();let job,done=false;
  job=M.createBudgetJob({...clock,total:1,step:()=>{},progress:()=>job.cancel(),done:()=>{done=true;}});
  clock.run();assert.equal(done,false);assert.equal(clock.pending,0);
});

test('R2 benchmark counts prechange-only positive classification as missed detection',()=>{
  const b=M.createBenchmark(1000,.1),base=Array.from({length:12},(_,i)=>i%2?9:7);
  b.add({X:[...base,100,...Array(23).fill(8)],change:{month:7,from:.1,to:.14}});
  const r=b.result();
  for(const key of ['mi1','miA'])assert.equal(r.metrics[key].numerator,0);
  for(const key of ['rule1','combined']){
    assert.equal(r.detection[key].postChangeNoSignal.numerator,1);
    assert.equal(r.detection[key].prechangeFalseAlarm.numerator,1);
    assert.equal(r.detection[key].meanDelay,null);
  }
});
