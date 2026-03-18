import { Suspense } from 'react'
import { ProfileEditor } from '@/components/user/profile-editor'
import { Card, CardContent } from '@/components/ui/card'

export default function ProfilePage() {
  return (
    <div className="container mx-auto py-6 max-w-2xl">
      <Suspense fallback={
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      }>
        <ProfileEditor />
      </Suspense>
    </div>
  )
}