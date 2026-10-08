export type Iloader = (val: boolean) => void
export type IOnComplete = (data: any, message?: string) => void
export type IOnError = (data: any, message?: string) => void
export type FormObject = Record<string, any>;
export type FormErrors<Form extends FormObject> = Record<keyof Form, string[]>
export interface IBaseResponse<T = any> {
    message: string,
    status: number,
    data: T
}