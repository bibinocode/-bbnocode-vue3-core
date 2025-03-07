export enum ReactiveFlags {
  IS_READONLY = '__isReadonly',
  IS_REACTIVE = '__isReactive'
}

export enum TrackOpTypes {
  GET = 'get',
  HAS = 'has',
  ITERATE = 'iterate'
}



export enum TriggerOpTypes {
  SET = 'set',
  ADD = 'add',
  DELETE = 'delete',
  CLEAR = 'clear',
}