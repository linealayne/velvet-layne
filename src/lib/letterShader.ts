/**
 * The fragment shader source for the eleven hero letter scenes. `K(n.)` marks
 * the code for letter n (V E L V E T / L A Y N E = 0..10). Every scene is a
 * glossy, liquid material in the show's palette: oxblood, chrome, signal
 * orange, black.
 *
 * `letterFrag(kind)` turns this into the shader for ONE letter by replacing
 * every `K(n.)` with a literal true or false, so the compiler throws the other
 * ten scenes away. That matters: compiled as a single program with the letter
 * chosen by a uniform, this took over 100 seconds to link (the driver
 * flattens every branch). As eleven constant-folded programs, each links in
 * well under half a second.
 *
 * Letters 2 (the pour) and 8 (the Y) are the two original chrome scenes and
 * their code is unchanged. Do not retune 8: the Y is the reference the others
 * were built to match.
 */
const SOURCE = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;

const vec3 OX=vec3(.36,.035,.075);
const vec3 MOLT=vec3(.77,.0,.11);
const vec3 SIG=vec3(1.,.3,.0);
const vec3 CHR=vec3(.79,.81,.84);
const vec3 BONE=vec3(.94,.89,.82);

float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,v=0.;for(int i=0;i<4;i++){v+=a*noise(p);p=mat2(1.6,1.2,-1.2,1.6)*p;a*=.5;}return v;}

float height(vec2 p){
  if(K(2.)){
    // pour: long ropes of metal running down the letter
    vec2 q=vec2(p.x*2.3,p.y*.3+uTime*.95);
    float w=fbm(q*.7+vec2(0.,uTime*.3));
    return fbm(q+vec2(w*1.7,0.));
  }
  if(K(8.)){
    // surface: a slow rolling swell
    vec2 q=p*1.25+vec2(uTime*.12,-uTime*.08);
    float w=fbm(q*1.1-uTime*.15);
    return fbm(q+w*1.6);
  }
  if(K(1.)){
    // marbling: two liquids folded into each other
    vec2 q=p*1.05+vec2(uTime*.06,uTime*.045);
    float w=fbm(q*1.3+uTime*.09);
    return fbm(q+w*2.3);
  }
  if(K(3.)){
    // mercury: rings spreading from two wandering drops
    vec2 a=vec2(sin(uTime*.4)*.28,cos(uTime*.31)*.55);
    vec2 b=vec2(cos(uTime*.27)*.3,-.35+sin(uTime*.5)*.5);
    float da=length(p-a),db=length(p-b);
    float h=sin(da*24.-uTime*4.2)/(1.+da*4.)+sin(db*19.-uTime*3.4)/(1.+db*4.);
    return h*.07+fbm(p*1.4+uTime*.08)*.45;
  }
  if(K(4.)){
    // crushed velvet: tight, blotchy creases
    vec2 q=p*1.9+vec2(uTime*.02,-uTime*.015);
    return fbm(q+fbm(q*1.9)*1.3);
  }
  if(K(7.)){
    // nebula: liquid wound around a centre
    float r=length(p);
    float a=atan(p.y,p.x)+uTime*.22+1.5/(r+.32);
    vec2 q=vec2(cos(a),sin(a))*r*2.3;
    float w=fbm(q+uTime*.05);
    return fbm(q*1.15+w*1.9);
  }
  if(K(9.)){
    // wet black chrome: a film of water, drifting
    return fbm(p*vec2(2.2,5.5)+vec2(0.,uTime*.22))*.55;
  }
  return fbm(p*1.3+uTime*.1);
}

// A studio to reflect: bright banded sky, dark cap, orange horizon, oxblood floor.
vec3 studio(vec3 r){
  float y=r.y,x=r.x;
  vec3 c=vec3(.02,.016,.018);
  c=mix(c,vec3(.96,.94,.9),smoothstep(.04,.45,y)*(.5+.5*sin(y*10.+x*3.)));
  c=mix(c,vec3(.03,.02,.02),smoothstep(.74,.92,y));
  c+=vec3(1.,.3,.02)*exp(-pow((y+.03)*6.5,2.))*(K(2.)?1.5:1.05);
  c+=vec3(.64,.0,.08)*smoothstep(-.12,-.8,y);
  c+=vec3(.8,.84,.9)*exp(-pow((x-.5)*5.,2.))*.45*smoothstep(-.4,.1,y);
  return c;
}

vec3 normalAt(vec2 p,float k){
  float e=.02;
  return normalize(vec3((height(p-vec2(e,0.))-height(p+vec2(e,0.)))/e*k*.5,
                        (height(p-vec2(0.,e))-height(p+vec2(0.,e)))/e*k*.5,1.));
}

float seg(vec2 p,vec2 a,vec2 b){
  vec2 pa=p-a,ba=b-a;
  return length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.,1.));
}

// N: the neon tube, in screen units (x 0..1, y scaled by the letter's shape).
float tube(vec2 q,float A){
  vec2 a=vec2(.22,.9*A),b=vec2(.78,.73*A),c=vec2(.24,.53*A),d=vec2(.76,.34*A),e=vec2(.24,.1*A);
  return min(min(seg(q,a,b),seg(q,b,c)),min(seg(q,c,d),seg(q,d,e)));
}

// E: the layout. x, y, w, h with y measured from the top.
vec4 block(int i){
  if(i==0) return vec4(.08,.05,.84,.045);
  if(i==1) return vec4(.08,.125,.84,.27);
  if(i==2) return vec4(.08,.43,.62,.035);
  if(i==3) return vec4(.08,.485,.42,.035);
  if(i==4) return vec4(.08,.57,.4,.19);
  if(i==5) return vec4(.52,.57,.4,.19);
  if(i==6) return vec4(.08,.79,.4,.035);
  if(i==7) return vec4(.52,.79,.4,.035);
  return vec4(.08,.87,.36,.06);
}

void main(){
  vec2 p=(gl_FragCoord.xy-.5*uRes)/min(uRes.x,uRes.y);
  vec2 uv=gl_FragCoord.xy/uRes;
  vec3 col;

  if(K(2.)||K(8.)){
    // The original chrome: unchanged.
    float k=K(2.)?1.5:2.1;
    float h0=height(p);
    vec3 n=normalAt(p,k);
    vec3 r=reflect(vec3(0.,0.,-1.),n);
    col=studio(r)*(.75+.5*h0);
    col+=pow(1.-n.z,2.)*vec3(.5,.45,.4);

  }else if(K(0.)){
    // V: a record pressed in black lacquer, wet with light. The grooves pull
    // the studio out into long chrome, orange and oxblood streaks, and the
    // whole disc swells a little as it turns, like the Y's liquid surface.
    vec2 d=p-vec2(0.,-.38);
    float r=length(d),a=atan(d.y,d.x);
    float sp=uTime*.8;
    vec2 rad=d/max(r,.001);
    // the disc is never quite flat: a slow swell that turns with it
    float sw=fbm(vec2(cos(a+sp),sin(a+sp))*r*2.4+vec2(3.,7.));
    float sw2=fbm(vec2(cos(a+sp+.4),sin(a+sp+.4))*r*2.4+vec2(3.,7.));
    float g=sin(r*190.+sw*9.);
    vec3 n=normalize(vec3(rad*(g*.38+(sw-.5)*1.5)+vec2(-rad.y,rad.x)*(sw2-sw)*5.,1.));
    vec3 rf=reflect(vec3(0.,0.,-1.),n);
    // grooves smear a reflection around the disc: sample the studio along them
    float around=a-sp*.55+(sw-.5)*1.3;
    vec3 env=studio(normalize(vec3(cos(around)*.9,sin(around)*.75+rf.y*.6+.12,.5)));
    float band=.5+.5*sin(r*11.-sw*6.);
    col=vec3(.006,.004,.005);
    col+=env*env*(.5+.7*band)*(.55+.45*g);
    // the three hard streaks a record always has
    float s1=pow(abs(cos(around)),70.);
    float s2=pow(abs(cos(around+1.2)),18.);
    float s3=pow(abs(cos(around-.62)),9.);
    col+=CHR*1.7*s1*(.6+.4*g)+vec3(1.)*pow(s1,5.)*.9;
    col+=SIG*.95*s2*(.45+.55*g)*(.4+.6*band);
    col+=MOLT*.7*s3*(.4+.6*g)*(1.-band*.6);
    // rim light off the lacquer itself
    col+=pow(1.-n.z,2.)*vec3(.5,.45,.4)*.7;
    // the gaps between tracks, and the run-out
    col*=1.-.75*smoothstep(.94,1.,sin(r*23.+.6));
    col*=smoothstep(.2,.27,r)*.85+.15;
    // the label: a dome of molten lacquer
    float sl=uTime*3.2;
    vec2 dd=mat2(cos(sl),-sin(sl),sin(sl),cos(sl))*d;
    vec3 ln=normalize(vec3(d*2.6+(sw-.5)*.3,1.));
    vec3 lr=reflect(vec3(0.,0.,-1.),ln);
    vec3 lab=MOLT*(.55+.5*sw)+OX*.4+studio(lr)*.55;
    lab=mix(lab,BONE,step(abs(dd.y-.075),.011)*step(abs(dd.x),.12));
    lab=mix(lab,SIG,step(abs(dd.y+.06),.008)*step(abs(dd.x),.085));
    lab+=vec3(1.,.9,.8)*pow(max(0.,1.-length(d-vec2(-.06,.07))*9.),3.)*.8;
    col=mix(col,lab,smoothstep(.205,.195,r));
    col=mix(col,CHR*.9,smoothstep(.205,.2,r)*smoothstep(.19,.196,r));
    col=mix(col,vec3(0.),smoothstep(.026,.02,r));

  }else if(K(1.)){
    // E: oxblood lacquer and liquid chrome, marbled.
    float h0=height(p);
    vec3 n=normalAt(p,2.);
    vec3 r=reflect(vec3(0.,0.,-1.),n);
    float m=smoothstep(.3,.56,sin(h0*15.+uTime*.3)*.5+.5);
    vec3 chrome=studio(r)*(.75+.5*h0);
    vec3 lacquer=OX*(.3+.75*h0)+MOLT*.06+studio(r)*.2;
    col=mix(lacquer,chrome,m);
    col+=pow(1.-n.z,2.)*vec3(.5,.45,.4)*.8;

  }else if(K(3.)){
    // V: mercury, rippling, with the red field in it.
    float h0=height(p);
    vec3 n=normalAt(p,2.6);
    vec3 r=reflect(vec3(0.,0.,-1.),n);
    vec3 s=studio(r);
    col=mix(vec3(dot(s,vec3(.34))),s,.2)*(.8+.4*h0);
    col+=MOLT*.5*smoothstep(.1,.8,r.x*.8+r.y*.6);
    col*=vec3(.96,.97,1.);
    col+=pow(1.-n.z,2.)*vec3(.6,.5,.5);

  }else if(K(4.)){
    // E: crushed oxblood velvet, a light moving over the pile.
    vec3 n=normalAt(p,2.4);
    vec3 L=normalize(vec3(cos(uTime*.55),sin(uTime*.55),.55));
    float diff=max(dot(n,L),0.);
    float sheen=pow(1.-n.z,1.15);
    col=mix(vec3(.045,.004,.012),vec3(.5,.035,.08),smoothstep(0.,1.,diff*.45+sheen*1.7));
    col+=vec3(1.,.2,.22)*pow(diff,7.)*.5;
    col+=vec3(1.,.5,.4)*pow(sheen,3.)*.5;
    col*=.8+.35*noise(vec2(gl_FragCoord.x*.6,gl_FragCoord.y*.1));

  }else if(K(5.)){
    // T: the Corridor in miniature, built out of wet lacquer and chrome.
    // Panels of oxblood, orange, bone and chrome rush in along four walls of
    // black glass that mirror them; a white-hot point burns at the far end.
    vec2 q=p+vec2(0.,.06);
    float ax=abs(q.x)/.3,ay=abs(q.y)/.62;
    float m=max(max(ax,ay),.02);
    float z=1./m;
    bool wall=ax>ay;
    float across=wall?q.y/max(abs(q.x),.001)*.3:q.x/max(abs(q.y),.001)*.62;
    float face=wall?(q.x>0.?3.:7.):(q.y>0.?11.:17.);
    float zz=z*1.5+uTime*2.7;
    vec2 cell=vec2(floor(zz),floor(across*2.2+.5));
    vec2 f=vec2(fract(zz),fract(across*2.2+.5));
    float id=hash(cell+face);
    float inx=smoothstep(.08,.12,f.x)*smoothstep(.92,.88,f.x);
    float iny=smoothstep(.07,.11,f.y)*smoothstep(.93,.89,f.y);
    float panel=inx*iny*step(.3,id);
    vec3 pc=id<.5?MOLT:id<.66?SIG:id<.8?OX*1.7:id<.91?CHR*.9:BONE*.9;
    float light=smoothstep(13.,.9,z);
    // every surface is wet: a rippled normal carries the studio across it
    vec3 n=normalAt(p*1.6+vec2(0.,uTime*.25),1.5);
    vec3 r=reflect(vec3(0.,0.,-1.),n);
    vec3 env=studio(r);
    // lacquer panels: colour, a pillowed face, a hard streak of light
    vec2 c2=f*2.-1.;
    float pill=1.-.5*pow(max(abs(c2.x),abs(c2.y)),4.);
    vec3 lac=pc*(.34+.5*pill)+env*.3;
    lac+=vec3(1.)*pow(max(0.,1.-abs(f.y-.26+n.x*.4)*5.5),7.)*.45;
    lac+=CHR*pow(max(0.,1.-abs(f.x-.82)*9.),4.)*.25;
    // black glass between them, mirroring the colour next door
    vec3 glass=vec3(.006,.004,.005)+env*.14+pc*.2*(1.-iny)*inx*step(.3,id);
    glass+=pc*.16*smoothstep(.5,0.,abs(f.x-.5))*step(.3,id);
    col=mix(glass,lac,panel)*light;
    // the floor and ceiling run with long reflections
    if(!wall) col+=pc*.3*light*(1.-panel)*smoothstep(.75,.0,f.x)*step(.3,id);
    // the far end: heat
    float far=exp(-m*7.5);
    col+=vec3(1.,.78,.5)*far*1.1+SIG*exp(-m*3.6)*.4+MOLT*exp(-m*1.8)*.16;
    // oxblood haze in the depth instead of plain black
    col+=OX*.5*smoothstep(4.,13.,z)*(1.-far);
    col+=pow(1.-n.z,2.)*vec3(.5,.45,.4)*.5*light;
    // the frame at the centre, in chrome
    if(m<.135){
      vec3 fr=studio(reflect(vec3(0.,0.,-1.),normalize(vec3(q*9.,1.))))*1.1+CHR*.1;
      col=m>.108?fr:vec3(.012)+env*.1+vec3(1.,.5,.2)*exp(-length(q)*30.)*.7;
    }

  }else if(K(6.)){
    // L: a white-hot pool of metal, sparks skating over it.
    vec2 q=p*1.5+vec2(uTime*.04,-uTime*.07);
    float w=fbm(q+uTime*.11);
    float h0=fbm(q*1.3+w*2.1);
    float heat=smoothstep(.12,.68,h0);
    col=mix(vec3(.03,.0,.0),MOLT,smoothstep(0.,.3,heat));
    col=mix(col,SIG,smoothstep(.28,.62,heat));
    col=mix(col,vec3(1.,.96,.82),smoothstep(.66,1.,heat));
    col*=.5+.5*smoothstep(.015,.075,abs(fbm(q*2.6-uTime*.05)-.5));
    col+=vec3(1.,.9,.8)*pow(heat,5.)*.25;
    float A=uRes.y/uRes.x;
    for(int i=0;i<7;i++){
      float fi=float(i);
      float tt=uTime*(.16+.035*fi)+fi*.37;
      vec2 s=vec2(sin(uTime*(.7+.17*fi)+fi*2.1)*.36,(fract(tt)*2.-1.)*A*.56);
      vec2 dir=normalize(vec2(cos(uTime*(.7+.17*fi)+fi*2.1)*.5,1.));
      float d=seg(p,s,s-dir*.1);
      col+=vec3(1.,.72,.3)*exp(-d*95.)*1.3+vec3(1.,.4,.05)*exp(-d*26.)*.2;
    }

  }else if(K(7.)){
    // A: a slow liquid nebula.
    float h0=height(p);
    vec3 n=normalAt(p,2.);
    vec3 r=reflect(vec3(0.,0.,-1.),n);
    col=mix(vec3(.02,.0,.02),OX*1.5,smoothstep(.2,.55,h0));
    col=mix(col,SIG,smoothstep(.52,.76,h0));
    col=mix(col,CHR,smoothstep(.76,.93,h0));
    col=col*(.7+.6*h0)+studio(r)*.32*smoothstep(.25,.8,h0);
    col+=pow(1.-n.z,2.)*vec3(.5,.45,.4)*.6;
    col+=vec3(1.,.82,.6)*exp(-length(p)*7.)*.7;

  }else if(K(9.)){
    // N: a red neon tube buzzing on, in wet black chrome.
    float A=uRes.y/uRes.x;
    vec2 q=vec2(uv.x,uv.y*A);
    float t=mod(uTime,3.6);
    float I=t<.22?0.:t<.27?1.:t<.42?0.:t<.47?.8:t<.66?.08:t<.74?1.:t<.86?.3:.92+.08*sin(uTime*70.);
    vec3 n=normalAt(p,2.2);
    vec3 r=reflect(vec3(0.,0.,-1.),n);
    col=vec3(.008,.004,.006)+studio(r)*.13;
    // the tube mirrored in the wet surface, smeared by the ripples
    float dr=tube(q+n.xy*.09+vec2(.05,-.03),A);
    col+=vec3(1.,.06,.1)*I*(exp(-dr*8.)*.55+exp(-dr*26.)*.5);
    float d=tube(q,A);
    col+=vec3(.2,.02,.03)*smoothstep(.03,.02,d)*(1.-I);
    col+=vec3(1.,.07,.12)*I*(exp(-d*60.)*1.5+exp(-d*13.)*.4);
    col+=vec3(1.,.85,.8)*I*smoothstep(.016,.006,d);

  }else{
    // E: a layout snapping together out of poured blocks. Each one is a
    // pillow of liquid chrome, oxblood or orange lacquer or black glass,
    // on a floor of wet black chrome that mirrors them.
    float A=uRes.y/uRes.x;
    vec2 q=vec2(uv.x,1.-uv.y);
    float loop=mod(uTime,3.6);
    float gone=clamp((loop-3.1)/.32,0.,1.);
    // the liquid: one slow swell shared by the floor and every block
    vec3 wn=normalAt(p*1.5,1.7);
    float h0=height(p*1.5);
    vec3 fr=reflect(vec3(0.,0.,-1.),wn);
    col=vec3(.006,.004,.005)+studio(fr)*.2+OX*.22*smoothstep(.2,.8,h0);
    for(int i=0;i<9;i++){
      vec4 b=block(i);
      float fi=float(i);
      float pr=clamp((loop-fi*.17)/.34,0.,1.);
      if(pr<=0.) continue;
      float e=1.+2.70158*pow(pr-1.,3.)+1.70158*pow(pr-1.,2.);
      float away=(1.-e)*.9;
      int dir=i==0||i==8?0:(i==1||i==5?1:(i==4?3:2));
      vec2 off=dir==0?vec2(0.,-away):dir==1?vec2(away,0.):dir==3?vec2(-away,0.):vec2(0.,away*.5);
      off.y+=gone*.08;
      vec2 l=(q-b.xy-off)/b.zw;
      float alpha=min(1.,pr*3.)*(1.-gone);
      // its reflection lying on the wet floor just below it
      vec2 lm=vec2(l.x+wn.x*.25,(q.y-b.y-b.w-off.y)/b.w);
      if(lm.x>0.&&lm.x<1.&&lm.y>0.&&lm.y<.9){
        vec3 tint=i==1?SIG:(i==4||i==5)?MOLT:i==8?SIG:CHR*.8;
        col+=tint*.2*(1.-lm.y/.9)*alpha*(.6+.8*h0);
      }
      if(l.x<0.||l.x>1.||l.y<0.||l.y>1.) continue;
      // a pillowed face: steep at the edges, swelling in the middle
      vec2 c=l*2.-1.;
      vec2 edge=vec2(b.z,b.w*A);
      float thin=min(1.,edge.x/edge.y*.4+.3);
      vec2 bev=sign(c)*pow(abs(c),vec2(4.))*vec2(1.,thin);
      vec3 n=normalize(vec3(bev.x*1.5+(l.x-.5)*.3+wn.x*.9,-bev.y*1.5-(l.y-.5)*.55+wn.y*.9,1.));
      vec3 r=reflect(vec3(0.,0.,-1.),n);
      vec3 s=studio(r);
      vec3 mat=i==1?SIG*.7+s*.5+vec3(1.,.5,.1)*h0*.25
              :(i==4||i==5)?OX*.9+MOLT*.25*h0+s*.5
              :i==8?SIG*.85+s*.4
              :(i==2||i==6)?s*1.15+CHR*.06
              :(i==3||i==7)?vec3(.012)+s*.55+OX*.3
              :s*1.05+CHR*.1;
      // a wet highlight across the top, and light caught in the rim
      mat+=vec3(1.)*pow(max(0.,1.-abs(l.y-.2-wn.y*.5)*4.5),6.)*.3;
      mat+=pow(1.-n.z,2.)*vec3(.6,.5,.45)*.8;
      mat*=.55+.45*smoothstep(1.,.55,max(abs(c.x),abs(c.y)*thin));
      col=mix(col,mat,alpha);
    }
  }
  gl_FragColor=vec4(col,1.);
}`;

export const LETTER_KINDS = 11;

/** The complete fragment shader for one letter. */
export function letterFrag(kind: number) {
  return SOURCE.replace(/K\((\d+)\.\)/g, (_, n) => (Number(n) === kind ? "true" : "false"));
}
