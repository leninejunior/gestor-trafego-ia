import { Suspense } from 'react'
import { MasterUserPanel } from '@/components/admin/master-user-panel'
import { Card, CardContent } from '@/components/ui/card'

export default function MasterPanelPage() {
  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      }>
        <MasterUserPanel />
      </Suspense>
    </div>
  )
}