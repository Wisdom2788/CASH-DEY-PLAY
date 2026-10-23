export class UnknownTaskError extends Error {
  constructor(public readonly taskId: string) {
    super(`Unknown task: ${taskId}`);
    this.name = "UnknownTaskError";
  }
}

export class TaskAlreadyCompletedError extends Error {
  constructor(public readonly taskId: string) {
    super(`Task already completed today: ${taskId}`);
    this.name = "TaskAlreadyCompletedError";
  }
}
