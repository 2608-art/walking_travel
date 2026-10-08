const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const sandbox={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/plan-audit.js'),'utf8'),sandbox);
const {assessLeg}=sandbox.module.exports;

assert.equal(assessLeg({walk:{minutes:12,meters:650},availableMinutes:20}).status,'ok');
assert.equal(assessLeg({walk:{minutes:12,meters:650},availableMinutes:8}).status,'short');
assert.equal(assessLeg({walk:{minutes:12,meters:650},bus:{minutes:7,walkMeters:150},availableMinutes:8}).status,'check-bus');
const bus=assessLeg({walk:{minutes:38,meters:2100},bus:{minutes:24,walkMeters:350},availableMinutes:40});
assert.equal(bus.mode,'bus');
assert.equal(bus.status,'check-bus');
assert.equal(assessLeg({walk:{minutes:38,meters:2100},bus:{minutes:45,walkMeters:350},availableMinutes:40}).status,'short');
assert.equal(assessLeg({walk:{minutes:38,meters:2100},bus:{minutes:24,busAccessUnknown:true},availableMinutes:40}).status,'over-walk-limit');
assert.equal(assessLeg({walk:null,bus:null,availableMinutes:40}).status,'unknown');
console.log('계획표 이동 구간 경계 확인 완료');
