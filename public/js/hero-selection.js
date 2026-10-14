// Selection never depends on the optional 3D preview completing.
export function createHeroSelection({profile,status,load,display}){
  let version=0,timer;
  return {select(config){
    const request=++version;clearTimeout(timer);
    profile(config);status('READY TO DEPLOY · PREVIEW LOADING…');
    timer=setTimeout(async()=>{
      try{
        const hero=await load(config);
        if(request!==version)return;
        await display(hero);if(request===version)status('OPERATOR READY');
      }catch(error){
        if(request===version)status('PREVIEW UNAVAILABLE · YOU CAN STILL DEPLOY');
        console.warn('Character preview',error);
      }
    },150);
  }};
}
