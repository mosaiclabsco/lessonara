import {describe,it,expect} from "vitest";
import {selectFilteredRecipients} from "./recipients";
describe("campaign selection",()=>{
 it("selects every student even when email addresses are repeated",()=>{expect(selectFilteredRecipients([],[{id:"a"},{id:"b"},{id:"c"}])).toEqual(["a","b","c"]);});
 it("preserves previous filters without duplicate students and caps at 100",()=>{const matches=Array.from({length:120},(_,i)=>({id:String(i)}));const selected=selectFilteredRecipients(["existing","0"],matches);expect(selected).toHaveLength(100);expect(selected.slice(0,3)).toEqual(["existing","0","1"]);});
});
