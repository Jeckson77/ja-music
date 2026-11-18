import React,{useEffect,useRef,useState} from 'react';
import './DemoMusic.css';

// Ten original, locally synthesized instrumental demo arrangements.
// Audio is generated in the browser; no third-party streams or copyrighted samples.
const notes={C:261.63,D:293.66,E:329.63,F:349.23,G:392,A:440,B:493.88};
const patterns=[
 ['Desert Sunrise','Ambient',78,'C E G B A G E D','C G A F'],
 ['City After Dark','Lo-fi',88,'A C E G E C D E','A F C G'],
 ['Coastal Drive','Electronic',112,'E G B A G E D B','E C G D'],
 ['Midnight Café','Jazz',94,'D F A C B A F E','D G C A'],
 ['Pink Horizon','Chill',82,'G B D E D B A G','G D E C'],
 ['Electric Avenue','Synth',126,'C G E G A G E D','C A F G'],
 ['Sandstorm Steps','Hip-hop',96,'F A C A G F E C','F C D A'],
 ['Quiet Constellations','Ambient',70,'E B G B A G E D','E A C G'],
 ['Golden Hour','Instrumental',104,'C D E G A G E D','C F G C'],
 ['Night Flight','Electronic',118,'A E C E G E D C','A G F E']
].map(([title,genre,bpm,melody,bass],i)=>({id:i+1,title,genre,bpm,melody:melody.split(' '),bass:bass.split(' ')}));
function frequency(n,oct=0){return (notes[n]||261.63)*Math.pow(2,oct)}
function schedule(ctx,output,track,start){
 const beat=60/track.bpm, bars=8, total=bars*4*beat;
 const gain=(at,duration,volume)=>{const g=ctx.createGain();g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(volume,at+.015);g.gain.exponentialRampToValueAtTime(.0001,at+duration);g.connect(output);return g};
 const tone=(f,at,duration,volume,type='sine')=>{const o=ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(f,at);o.connect(gain(at,duration,volume));o.start(at);o.stop(at+duration+.02)};
 for(let i=0;i<bars*4;i++){
  const t=start+i*beat, n=track.melody[i%track.melody.length];
  tone(frequency(n),t,beat*.83,.075,track.genre==='Electronic'||track.genre==='Synth'?'triangle':'sine');
  if(i%2===0)tone(frequency(track.bass[Math.floor(i/4)%track.bass.length],-2),t,beat*1.7,.105,'triangle');
  if(i%4===0)tone(65,t,.14,.075,'sine');
  if(i%4===2)tone(170,t,.085,.028,'triangle');
 }
 return total;
}
export default function DemoMusic(){
 const [selected,setSelected]=useState(0),[playing,setPlaying]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState('');
 const audio=useRef(null),token=useRef(0);
 function stop(){token.current++;if(audio.current){try{audio.current.ctx.close()}catch{}audio.current=null}setPlaying(false);setProgress(0)}
 async function play(index=selected){
  stop();setSelected(index);setError('');
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx){setError('This browser does not support Web Audio.');return}
  try{
   const ctx=new Ctx();await ctx.resume();const output=ctx.createGain();output.gain.value=.65;output.connect(ctx.destination);
   const duration=schedule(ctx,output,patterns[index],ctx.currentTime+.08);
   const id=++token.current;audio.current={ctx,duration,start:ctx.currentTime};
   setPlaying(true);
   const tick=()=>{if(id!==token.current)return;const elapsed=ctx.currentTime-audio.current.start;setProgress(Math.min(100,elapsed/duration*100));if(elapsed>=duration){play((index+1)%patterns.length);return}requestAnimationFrame(tick)};requestAnimationFrame(tick);
  }catch(e){setError('Audio could not start. Try pressing Play again.');setPlaying(false)}
 }
 useEffect(()=>()=>{token.current++;audio.current?.ctx.close().catch(()=>{})},[]);
 return <section className="demo-music" aria-label="Playable demo music"><div className="demo-music-heading"><div><span className="demo-music-kicker">LISTENER LIBRARY · ORIGINAL DEMO MUSIC</span><h2>Press play. Discover a sound.</h2><p>10 original instrumental sketches, synthesized locally in your browser. No streaming, downloads or purchases required. These are demonstrations, not Namibian artist releases.</p></div><span className="demo-music-count">10 TRACKS</span></div>
 <div className="demo-music-list">{patterns.map((track,i)=><button key={track.id} className={'demo-music-track '+(selected===i?'selected':'')} onClick={()=>playing&&selected===i?stop():play(i)} aria-label={(playing&&selected===i?'Pause ':'Play ')+track.title}><span className="demo-music-number">{playing&&selected===i?'❚❚':'▶'}</span><span className="demo-music-track-name"><strong>{track.title}</strong><small>Ja Music Demo · {track.genre}</small></span><span className="demo-music-tempo">{track.bpm} BPM</span></button>)}</div>
 <div className="demo-music-controls"><div><small>NOW PLAYING</small><strong>{patterns[selected].title}</strong></div><div className="demo-music-buttons"><button onClick={()=>play((selected+9)%10)} aria-label="Previous track">⏮</button><button onClick={()=>playing?stop():play()} aria-label={playing?'Pause':'Play'}>{playing?'❚❚':'▶'}</button><button onClick={()=>play((selected+1)%10)} aria-label="Next track">⏭</button></div><div className="demo-music-progress" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin="0" aria-valuemax="100" aria-label="Track progress"><span style={{width:progress+'%'}}/></div></div>{error&&<p role="alert">{error}</p>}
 </section>
}
