import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from './screen-inventory.mjs';
test('records action locations and leaves parity and roles unproven',()=>{
 const result=inspect('<Route path="/admin" />\n<button onClick={save} aria-label="حفظ"/>\napi.save()');
 assert.deepEqual(result.routes,[{value:'/admin',line:1}]);
 assert.deepEqual(result.events,[{value:'onClick',line:2}]);
 assert.equal(result.apiCandidates[0].value,'api.save');
 assert.equal(result.role,'UNKNOWN'); assert.equal(result.status,'UNKNOWN'); assert.deepEqual(result.visualEvidence,[]);
});
test('does not invent dynamic navigation values',()=>{
 assert.deepEqual(inspect('<Link to={getPath(id)}/>').navigation,[]);
});
