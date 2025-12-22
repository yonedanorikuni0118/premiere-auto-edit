/**
 * ゲーム実況風スタイルプリセット
 * 派手で目立つ、ゲーム実況動画で使われるようなテロップスタイル
 */
export const gamingPreset = {
  name: 'gaming',
  displayName: 'ゲーム実況風',
  description: '派手で目立つゲーム実況スタイル',
  style: {
    fontSize: 56,
    fontFamily: 'Impact',
    fontColor: '#FF3333', // 赤
    strokeColor: 'white',
    strokeWidth: 5,
    position: 'top',
    yOffset: 80,
    animation: 'zoom-in',
    animationDuration: 0.3,
    shadowX: 4,
    shadowY: 4,
    shadowColor: 'rgba(0,0,0,0.9)',
    backgroundColor: 'rgba(255,255,0,0.3)', // 半透明黄色
    backgroundOpacity: 0.3,
    backgroundPadding: 15,
  },
};
