export function visualSettings(value={}){
  const out={captionSize:Number(value.captionSize??62),captionBottom:Number(value.captionBottom??115),logoScale:Number(value.logoScale??1)};
  if(!Number.isFinite(out.captionSize)||out.captionSize<60||out.captionSize>64||!Number.isFinite(out.captionBottom)||out.captionBottom<108||out.captionBottom>134||!Number.isFinite(out.logoScale)||out.logoScale<.92||out.logoScale>1.08)throw new Error('Use caption size 60–64, bottom spacing 108–134, and logo scale 0.92–1.08. Smaller logos require a detected face-collision constraint.');return out;
}
