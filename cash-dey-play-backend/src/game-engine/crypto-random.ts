import { randomInt } from 'node:crypto';
import { RandomInt } from './model';
/** Production entropy adapter; never a seed or hidden-card order sent to a client. */
export const cryptoRandomInt:RandomInt=max=>randomInt(max);
export function recordRandom(source:RandomInt){const choices:{max:number;value:number}[]=[];return {choices,random:(max:number)=>{const value=source(max);choices.push({max,value});return value;}};}
export function replayRandom(choices:readonly {max:number;value:number}[]){let offset=0;return {random:(max:number)=>{const choice=choices[offset++];if(!choice||choice.max!==max)throw new Error('Invalid replay entropy');return choice.value;},complete:()=>offset===choices.length};}
