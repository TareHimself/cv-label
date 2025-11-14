import DefaultToast from "./DefaultToast";
import ToastContainer from "./ToastContainer";
import { IToastConfig, IToastPromiseRenderers, IToastUpdate, ToastConfigRendererPropsType } from "./types";

export * from "./types";
export { ToastContainer  };


export function toast(content: IToastConfig<ToastConfigRendererPropsType<undefined>>['render'],duration = 5000) {
  window._addNewToast({
    duration: duration,
    render: (props) => {
        if(typeof content === 'string'){
            return (
                <DefaultToast  props={props} data={content} />
            )
        }
        

        const toDisplay = content({props: props, data: undefined})

        if(typeof toDisplay === 'string'){
            return <DefaultToast props={props} data={toDisplay} />
        }
        
        return toDisplay
    }
  });
}

toast.update = function(toastId: string,update: IToastUpdate){
    window._updateToast(toastId,update)
}

toast.promise = async function <T>(promise: (() => Promise<T>) | Promise<T>,config: IToastPromiseRenderers<T> = {
    pending: "Loading",
    success: "Complete",
    error: "Ops",
    dismissDelay: 100
}){
    const toastId = window._addNewToast({
        duration: 'promise',
        render: (props) => {
            if(config.pending === undefined) config.pending = "Loading"

            if(typeof config.pending === 'string'){
                return <DefaultToast props={props} data={config.pending} />
            }


            const toDisplay = config.pending({ props, data: undefined })

            if(typeof toDisplay === 'string'){
                return <DefaultToast props={props} data={toDisplay} />
            }
            
            return toDisplay
        }
    })

    const actualDismissDelay = config.dismissDelay ?? 2000
    try {
        const result = promise instanceof Promise ? await promise : await promise()

        
        toast.update(toastId,{
            duration: actualDismissDelay,
            render: (props) => {
                if(config.success === undefined) config.pending = "Complete"

                if(typeof config.success === 'string'){
                    return <DefaultToast props={props} data={config.success} />
                }

                const toDisplay = config.success({ props, data: result})

                if(typeof toDisplay === 'string'){
                    return <DefaultToast props={props} data={toDisplay} />
                }
                
                return toDisplay
            }
        })

        return result

    } catch (error) {
        toast.update(toastId,{
            duration: actualDismissDelay,
            render: (props) => {
                if(config.error === undefined) config.error = "An Error Has Occured"
                
                if(typeof config.error === 'string'){
                    return <DefaultToast props={props} data={config.error} />
                }

                const toDisplay = config.error({ props, data: error})

                if(typeof toDisplay === 'string'){
                    return <DefaultToast props={props} data={toDisplay} />
                }
                
                return toDisplay
            }
        })
        throw error
    }

    
}
