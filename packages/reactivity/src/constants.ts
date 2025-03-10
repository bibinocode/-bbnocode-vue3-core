export enum ReactiveFlags {
	IS_READONLY = "__isReadonly",
	IS_REACTIVE = "__isReactive",
	IS_SHALLOW = '__v_isShallow',
	RAW = "__v_raw",
}

/**
 * 依赖收集标识 用于细化收集动作
 */
export enum TrackOpTypes {
	GET = "get", // 获取操作动作标识
	HAS = "has", // in 操作动作标识
	ITERATE = "iterate", // 遍历操作动作标识
}

/**
 * 触发更新标识 用于细化触发动作
 */
export enum TriggerOpTypes {
	SET = "set", // 设置操作动作标识
	ADD = "add", // 添加操作动作标识
	DELETE = "delete", // 删除操作动作标识
	CLEAR = "clear", // 清除操作动作标识
}
