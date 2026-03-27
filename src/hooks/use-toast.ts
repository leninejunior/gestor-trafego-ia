import { toast as sonnerToast } from 'sonner'

type ToastProps = {
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}

type ToastHandle = {
  id: string
  dismiss: () => void
  update: (next: ToastProps) => void
}

function buildToastMessage(props: ToastProps): { title: string; description?: string } {
  const title = props.title?.trim() || props.description?.trim() || 'Notificação'
  const description = props.title?.trim() ? props.description : undefined
  return { title, description }
}

function emitToast(props: ToastProps): ToastHandle {
  const message = buildToastMessage(props)
  const show = props.variant === 'destructive' ? sonnerToast.error : sonnerToast
  const id = show(message.title, {
    description: message.description
  })

  return {
    id: String(id),
    dismiss: () => sonnerToast.dismiss(id),
    update: (next) => {
      const nextMessage = buildToastMessage(next)
      const nextShow = next.variant === 'destructive' ? sonnerToast.error : sonnerToast
      nextShow(nextMessage.title, {
        id,
        description: nextMessage.description
      })
    }
  }
}

function useToast() {
  return {
    toast: emitToast,
    dismiss: (toastId?: string) => sonnerToast.dismiss(toastId),
    toasts: []
  }
}

export { useToast, emitToast as toast }
