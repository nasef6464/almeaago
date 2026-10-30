import test from 'node:test';import assert from 'node:assert/strict';
import {loadArticles,loadMocks} from './public-metadata.ts';
test('blog reads every explicit article page and only public metadata transport',async()=>{
 const before=globalThis.fetch;const seen=[];globalThis.fetch=async(url,init)=>{seen.push([url,init]);return {ok:true,json:async()=>({items:[{id:seen.length,title:'article'}],hasMore:seen.length<3})}};
 try{const items=await loadArticles(new AbortController().signal);assert.equal(items.length,3);assert.match(seen[2][0],/page=3&limit=100/);assert.equal(seen[0][1].credentials,'omit')}finally{globalThis.fetch=before}
});
test('failed mock metadata stays an error instead of a fabricated empty list',async()=>{const before=globalThis.fetch;globalThis.fetch=async()=>({ok:false});try{await assert.rejects(loadMocks(new AbortController().signal),/تعذر تحميل المحتوى/)}finally{globalThis.fetch=before}});
