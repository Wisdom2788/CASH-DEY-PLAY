import { rankedCooldownUntil } from './ranked.repository';
describe('ranked cooldown boundaries',()=>{
 it('starts from the finish instant and expires at exactly one hour',()=>{
  expect(rankedCooldownUntil(false,1000,1000,9999999)).toBe(3601000);
  expect(rankedCooldownUntil(false,1000,3600999,9999999)).toBe(3601000);
  expect(rankedCooldownUntil(false,1000,3601000,9999999)).toBeNull();
 });
 it('caps cooldown at Lagos midnight and exempts only current premium',()=>{
  const midnight=Date.parse('2026-10-26T00:00:00+01:00');const finish=midnight-600000;
  expect(rankedCooldownUntil(false,finish,midnight-1,midnight)).toBe(midnight);
  expect(rankedCooldownUntil(false,finish,midnight,midnight)).toBeNull();
  expect(rankedCooldownUntil(true,finish,finish,midnight)).toBeNull();
  expect(rankedCooldownUntil(false,null,finish,midnight)).toBeNull();
 });
});
