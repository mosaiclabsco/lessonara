import {it,expect} from "vitest";
import {movePlan} from "./plan-order";
it("moves only the requested plan and keeps invalid moves unchanged",()=>{const plans=[{id:"a"},{id:"b"},{id:"c"}];expect(movePlan(plans,"b",-1).map(p=>p.id)).toEqual(["b","a","c"]);expect(movePlan(plans,"a",-1)).toBe(plans);expect(movePlan(plans,"absent",1)).toBe(plans);expect(plans.map(p=>p.id)).toEqual(["a","b","c"]);});
