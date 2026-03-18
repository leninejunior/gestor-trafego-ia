'use client'

import { useState } from 'react'
import { Image as ImageIcon, Video, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface CreativeThumbnailProps {
  imageUrl?: string
  thumbnailUrl?: string
  title?: string
  body?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32'
}

export function CreativeThumbnail({
  imageUrl,
  thumbnailUrl,
  title,
  body,
  size = 'md',
  className
}: CreativeThumbnailProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)

  const displayUrl = thumbnailUrl || imageUrl

  if (!displayUrl) {
    return (
      <div className={cn(
        'flex items-center justify-center bg-muted rounded-lg',
        sizeClasses[size],
        className
      )}>
        <ImageIcon className="h-6 w-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowLightbox(true)}
        className={cn(
          'relative overflow-hidden rounded-lg border bg-muted hover:opacity-80 transition-opacity',
          sizeClasses[size],
          className
        )}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        ) : (
          <img
            src={displayUrl}
            alt={title || 'Creative'}
            className="w-full h-full object-cover"
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false)
              setError(true)
            }}
          />
        )}
      </button>

      <Dialog open={showLightbox} onOpenChange={setShowLightbox}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>{title || 'Criativo'}</DialogTitle>
          <div className="space-y-4">
            {displayUrl && !error && (
              <img
                src={imageUrl || displayUrl}
                alt={title || 'Creative'}
                className="w-full rounded-lg"
              />
            )}
            {body && (
              <p className="text-sm text-muted-foreground">{body}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
