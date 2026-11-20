import React,{useEffect,useMemo,useRef,useState} from 'react';
import './OrbitImages.css';
// OrbitImages: React Bits-inspired ellipse implementation adapted for this JSX/Vite project.
// The supplied reference is TypeScript; this implementation uses JavaScript without new packages.
export default function OrbitImages({images=[],radiusX=340,radiusY=80,rotation=-8,duration=30,itemSize=90,depth=.6,showPath=true,centerContent,altPrefix='Album cover',className='',hoverSpeed=.3,draggable=true,paused=false,clickToFront=true,shape='ellipse',width='100%',height='auto',itemRadius=12,onItemClick}){
 const ref=useRef(null),phase=useRef(0),last=useRef(0),drag=useRef(null),[progress,setProgress]=useState(0),[hover,setHover]=useState(false),[reduce,setReduce]=useState(false),[visible,setVisible]=useState(true),[size,setSize]=useState(900);
 const items=useMemo(()=>images.map((v,i)=>typeof v==='string'?{src:v,alt:altPrefix+' '+(i+1)}:v),[images,altPrefix]);
 useEffect(()=>{const m=window.matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setReduce(m.matches);change();m.addEventListener?.('change',change);return()=>m.removeEventListener?.('change',change)},[]);
 useEffect(()=>{const node=ref.current;if(!node)return;const ro=new ResizeObserver(e=>setSize(e[0].contentRect.width));ro.observe(node);const io=new IntersectionObserver(e=>setVisible(e[0].isIntersecting),{threshold:.05});io.observe(node);return()=>{ro.disconnect();io.disconnect()}},[]);
 useEffect(()=>{if(paused||reduce||!visible)return;let raf;const frame=t=>{const dt=last.current?Math.min((t-last.current)/1000,.1):0;last.current=t;if(!drag.current)phase.current=(phase.current+dt/(duration||30)*(hover?hoverSpeed:1))%1;setProgress(phase.current);raf=requestAnimationFrame(frame)};raf=requestAnimationFrame(frame);return()=>{cancelAnimationFrame(raf);last.current=0}},[paused,reduce,visible,hover,duration,hoverSpeed]);
 const scale=Math.min(1,size/920),rx=radiusX*scale,ry=radiusY*scale,unit=itemSize*scale,angle=rotation*Math.PI/180;
 const h=height==='auto'?Math.max(230,(radiusY*2+itemSize*2.1)*scale):height;
 const start=e=>{if(!draggable)return;drag.current={x:e.clientX,phase:phase.current};e.currentTarget.setPointerCapture?.(e.pointerId)};
 const move=e=>{if(!drag.current)return;phase.current=(drag.current.phase+(e.clientX-drag.current.x)/Math.max(1,rx*6)+1)%1;setProgress(phase.current)};
 const end=()=>{drag.current=null};
 return <div ref={ref} className={'orbit-container '+className} style={{width,height:h}} onPointerEnter={()=>setHover(true)} onPointerLeave={()=>setHover(false)} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} aria-label="Orbit of Namibian music album covers">
 {showPath&&<svg className="orbit-path-svg" viewBox="0 0 1000 400" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="500" cy="200" rx="390" ry="110" transform={'rotate('+rotation+' 500 200)'} fill="none" stroke="rgba(255,255,255,.24)" strokeWidth="1.5" strokeDasharray="7 9"/></svg>}
 {items.map((it,i)=>{const a=(progress+i/Math.max(1,items.length))*Math.PI*2;const x=rx*Math.cos(a),y=ry*Math.sin(a),px=x*Math.cos(angle)-y*Math.sin(angle),py=x*Math.sin(angle)+y*Math.cos(angle),front=(Math.sin(a)+1)/2,z=1+depth*(.3*front-.45*(1-front)),opacity=1-depth*.55*(1-front);return <div key={i} className="orbit-item" style={{width:unit,height:unit,left:'50%',top:'50%',opacity,zIndex:Math.round(front*100)+10,transform:'translate(-50%,-50%) translate('+px+'px,'+py+'px) scale('+z+')'}} onClick={()=>{if(clickToFront)phase.current=(.25-i/items.length+1)%1;onItemClick?.(i,it.src)}}><img src={it.src} alt={it.alt} loading="lazy" decoding="async" draggable={false} style={{borderRadius:typeof itemRadius==='number'?itemRadius*scale:itemRadius}}/></div>})}
 <div className="orbit-center-content">{centerContent}</div>
 </div>;
}