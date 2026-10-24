import { assertKobo, wholeNairaToKobo, MAX_KOBO } from './amount';
describe('checked accounting amounts',()=>{
  it('converts exact bounded whole naira',()=>{
    expect(wholeNairaToKobo(1)).toBe(100);
    expect(wholeNairaToKobo(MAX_KOBO/100)).toBe(MAX_KOBO);
    expect(()=>assertKobo(-1)).not.toThrow();
  });
  it.each([0,-1,0.1,NaN,Infinity,MAX_KOBO/100+1,'100',null])('rejects invalid naira %s',value=>{
    expect(()=>wholeNairaToKobo(value as number)).toThrow();
  });
  it.each([0,0.1,NaN,Infinity,MAX_KOBO+1,-MAX_KOBO-1,'1',null])('rejects invalid kobo %s',value=>{
    expect(()=>assertKobo(value as number)).toThrow();
  });
});
