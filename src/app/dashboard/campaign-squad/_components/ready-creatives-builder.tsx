'use client'

import { type ChangeEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { type ReadyCreativeInput, requestJson } from '@/lib/campaign-squad/dashboard'

type ReadyCreativesBuilderProps = {
  organizationId: string
  clientId: string
  value: ReadyCreativeInput[]
  onChange: (nextValue: ReadyCreativeInput[]) => void
}

const EMPTY_DRAFT: ReadyCreativeInput = {
  type: 'image',
  title: '',
  storageUrl: '',
  content: '',
  fileName: '',
  mimeType: '',
  publicUrl: ''
}

export function ReadyCreativesBuilder({ organizationId, clientId, value, onChange }: ReadyCreativesBuilderProps) {
  const { toast } = useToast()
  const [draft, setDraft] = useState<ReadyCreativeInput>(EMPTY_DRAFT)
  const [uploading, setUploading] = useState(false)

  const handleAddReadyCreative = () => {
    const title = draft.title.trim()
    const storageUrl = draft.storageUrl?.trim() || ''
    const content = draft.content?.trim() || ''

    if (!title) {
      toast({ title: 'Informe o título do criativo pronto', variant: 'destructive' })
      return
    }
    if (!storageUrl && !content) {
      toast({ title: 'Informe URL pública ou conteúdo do criativo', variant: 'destructive' })
      return
    }
    if (storageUrl && storageUrl.length < 8) {
      toast({
        title: 'Referência do criativo inválida',
        description: 'Informe uma URL/URI válida ou faça upload de arquivo.',
        variant: 'destructive'
      })
      return
    }

    const nextCreative: ReadyCreativeInput = {
      type: draft.type,
      title,
      ...(storageUrl ? { storageUrl } : {}),
      ...(draft.publicUrl?.trim() ? { publicUrl: draft.publicUrl.trim() } : {}),
      ...(content ? { content } : {}),
      ...(draft.fileName?.trim() ? { fileName: draft.fileName.trim() } : {}),
      ...(draft.mimeType?.trim() ? { mimeType: draft.mimeType.trim() } : {})
    }

    onChange([...value, nextCreative])
    setDraft(EMPTY_DRAFT)
  }

  const handleRemoveReadyCreative = (index: number) => {
    onChange(value.filter((_, currentIndex) => currentIndex !== index))
  }

  const handleReadyCreativeFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const maxBytes = 700 * 1024
    if (file.size > maxBytes) {
      toast({
        title: 'Arquivo muito grande',
        description: 'Use arquivo até 700KB para envio embutido no run.',
        variant: 'destructive'
      })
      return
    }

    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      if (!dataUrl) {
        toast({
          title: 'Falha ao ler arquivo',
          description: 'Não foi possível converter o arquivo para envio.',
          variant: 'destructive'
        })
        return
      }

      setUploading(true)
      try {
        const uploaded = await requestJson<{
          storageUrl: string
          publicUrl?: string | null
          contentType?: string
        }>('/api/campaign-squad/uploads/ready-creative', {
          method: 'POST',
          body: JSON.stringify({
            organizationId: organizationId.trim() || 'default',
            clientId: clientId.trim() || 'general',
            fileName: file.name,
            mimeType: file.type || undefined,
            dataUrl
          })
        })

        setDraft((prev) => ({
          ...prev,
          storageUrl: uploaded.storageUrl,
          publicUrl: uploaded.publicUrl || undefined,
          fileName: file.name,
          mimeType: file.type || undefined
        }))
        toast({
          title: 'Arquivo enviado para o MinIO',
          description: `${file.name} pronto para adicionar ao lote.`
        })
      } catch (error) {
        toast({
          title: 'Falha no upload do criativo',
          description: error instanceof Error ? error.message : 'Erro inesperado',
          variant: 'destructive'
        })
      } finally {
        setUploading(false)
      }
    }
    reader.onerror = () => {
      toast({
        title: 'Erro ao processar arquivo',
        description: 'Não foi possível ler o arquivo selecionado.',
        variant: 'destructive'
      })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <p className="text-sm font-medium">Criativos prontos (opcional)</p>
      <p className="text-xs text-muted-foreground">
        Adicione URLs públicas e/ou textos para o squad usar no planejamento.
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select
            value={draft.type}
            onValueChange={(newValue: ReadyCreativeInput['type']) => setDraft((prev) => ({ ...prev, type: newValue }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="image">image</SelectItem>
              <SelectItem value="video">video</SelectItem>
              <SelectItem value="copy">copy</SelectItem>
              <SelectItem value="video-script">video-script</SelectItem>
              <SelectItem value="headline">headline</SelectItem>
              <SelectItem value="primary-text">primary-text</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Título</Label>
          <Input
            value={draft.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Ex.: Vídeo depoimento cliente"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>URL pública do criativo (opcional)</Label>
          <Input
            value={draft.storageUrl || ''}
            onChange={(event) => setDraft((prev) => ({ ...prev, storageUrl: event.target.value }))}
            placeholder="https://cdn.suaempresa.com/criativos/video-1.mp4"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Ou subir arquivo (opcional)</Label>
          <Input type="file" accept="image/*,video/*,text/*" onChange={handleReadyCreativeFile} disabled={uploading} />
          {uploading ? <p className="text-xs text-muted-foreground">Enviando arquivo para o MinIO...</p> : null}
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Conteúdo textual (opcional)</Label>
          <Textarea
            value={draft.content || ''}
            onChange={(event) => setDraft((prev) => ({ ...prev, content: event.target.value }))}
            placeholder="Cole copy, headline, roteiro, CTA etc."
          />
        </div>
      </div>

      <Button type="button" variant="outline" onClick={handleAddReadyCreative}>
        Adicionar criativo pronto
      </Button>

      {value.length > 0 ? (
        <div className="space-y-2">
          {value.map((creative, index) => (
            <div key={`${creative.type}-${creative.title}-${index}`} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{creative.title}</p>
                  <p className="text-xs text-muted-foreground">Tipo: {creative.type}</p>
                </div>
                <Button type="button" variant="destructive" size="sm" onClick={() => handleRemoveReadyCreative(index)}>
                  Remover
                </Button>
              </div>
              {creative.storageUrl ? <p className="mt-2 text-xs text-muted-foreground">{creative.storageUrl}</p> : null}
              {creative.publicUrl ? <p className="mt-1 text-xs text-muted-foreground">{creative.publicUrl}</p> : null}
              {creative.fileName ? <p className="mt-1 text-xs text-muted-foreground">Arquivo: {creative.fileName}</p> : null}
              {creative.content ? <p className="mt-2 text-sm">{creative.content}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
