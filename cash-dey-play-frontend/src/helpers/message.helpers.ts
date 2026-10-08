import { toast } from "react-toastify";
import { type FormErrors, type FormObject } from "../types/interfaces/general.types";


export const renderErrorText = (error: string | []) => {
    if(!!error){
        return (Array.isArray(error))? error.join("\n") : error;
    }
    return "";
}

export const createFormErrorObject = <T extends FormObject>(formState: T): FormErrors<T> => {
    return Object.assign({},...Object.keys(formState).map(key => ({[key]:[]})))
}

export const errorMessage = (message: string) => {
    toast.error(message)
}

export const successMessage = (message: string) => {
    toast.success(message)
}