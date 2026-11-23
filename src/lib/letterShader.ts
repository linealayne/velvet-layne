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
    // V: glossy black vinyl, a chrome streak sliding across the grooves.
    vec2 d=p-vec2(0.,-.38);
    float r=length(d),a=atan(d.y,d.x);
    float groove=sin(r*150.)*.5+.5;
    col=vec3(.012)+vec3(.04)*groove;
    float s1=pow(abs(cos(a-uTime*.55)),110.);
    float s2=pow(abs(cos(a-uTime*.55+1.15)),26.);
    float s3=pow(abs(cos(a-uTime*.55-.5)),300.);
    col+=(CHR*1.5*s1+SIG*.55*s2+vec3(1.)*s3)*(.5+.5*groove)*smoothstep(.2,.3,r);
    col+=vec3(.07)*smoothstep(.97,1.,sin(r*21.));
    // label, spinning
    float sp=uTime*3.5;
    vec2 dd=mat2(cos(sp),-sin(sp),sin(sp),cos(sp))*d;
    vec3 lab=MOLT*(.8+.2*s1);
    lab=mix(lab,BONE,step(abs(dd.y-.075),.012)*step(abs(dd.x),.12));
    lab=mix(lab,BONE,step(abs(dd.y+.06),.008)*step(abs(dd.x),.08));
    lab+=vec3(1.)*s1*.3;
    col=mix(col,lab,smoothstep(.2,.192,r));
    col=mix(col,vec3(0.),smoothstep(.024,.018,r));

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
    // T: the Corridor in miniature, glossy.
    vec2 q=p+vec2(0.,.06);
    float ax=abs(q.x)/.3,ay=abs(q.y)/.62;
    float m=max(max(ax,ay),.02);
    float z=1./m;
    bool wall=ax>ay;
    float across=wall?q.y/max(abs(q.x),.001)*.3:q.x/max(abs(q.y),.001)*.62;
    float face=wall?(q.x>0.?3.:7.):(q.y>0.?11.:17.);
    float zz=z*.9+uTime*2.1;
    vec2 f=vec2(fract(zz),fract(across*1.5+.5));
    float id=hash(vec2(floor(zz),floor(across*1.5+.5)+face));
    float panel=step(.1,f.x)*step(f.x,.9)*step(.08,f.y)*step(f.y,.92)*step(.36,id);
    vec3 pc=id<.56?BONE:id<.72?SIG:id<.88?MOLT:CHR;
    float light=smoothstep(11.,1.1,z);
    col=pc*panel*light;
    // gloss: a hard highlight running down each panel, and the wet floor
    col+=vec3(1.)*pow(max(0.,1.-abs(f.y-.3)*5.),6.)*.35*panel*light;
    if(!wall&&q.y<0.) col+=pc*.35*light*(1.-panel)*smoothstep(.5,.0,f.x)+CHR*.06*light;
    col+=CHR*.05*light*(1.-panel);
    // the frame at the centre
    if(m<.13) col=m>.108?BONE:vec3(.015);

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
    // E: chrome and lacquer blocks snapping into a layout.
    float A=uRes.y/uRes.x;
    vec2 q=vec2(uv.x,1.-uv.y);
    float loop=mod(uTime,3.4);
    float gone=clamp((loop-2.9)/.3,0.,1.);
    col=vec3(.014,.01,.012)+CHR*.03*smoothstep(1.,0.,q.y);
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
      if(l.x<0.||l.x>1.||l.y<0.||l.y>1.) continue;
      // a soft bevel gives each block a rounded, glossy face
      vec2 c=l*2.-1.;
      vec2 edge=vec2(b.z,b.w*A);
      vec2 bev=sign(c)*pow(abs(c),vec2(5.))*vec2(1.,min(1.,edge.x/edge.y*.4+.3));
      vec3 n=normalize(vec3(bev.x*1.3+(l.x-.5)*.25,-bev.y*1.3-(l.y-.5)*.5,1.));
      vec3 r=reflect(vec3(0.,0.,-1.),n);
      vec3 s=studio(r);
      vec3 mat=i==1?SIG*.85+s*.3:(i==4||i==5)?OX*1.1+MOLT*.2+s*.35:i==8?MOLT*.9+s*.3:s*.95+CHR*.08;
      mat+=vec3(1.)*pow(max(0.,1.-abs(l.y-.22)*4.),5.)*.16;
      float alpha=min(1.,pr*3.)*(1.-gone);
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
