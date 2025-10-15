/**
 * Motor de Workflows e Automações
 * - Workflows visuais
 * - Triggers baseados em eventos
 * - Ações condicionais
 * - Integração com APIs externas
 */

import { createClient } from '@/lib/supabase/server'
import PushService from '@/lib/notifications/push-service'
import { NotificationService } from '@/lib/notifications/notification-service'

interface WorkflowTrigger {
  type: 'metric_threshold' | 'campaign_status' | 'schedule' | 'webhook' | 'manual'
  conditions: Record<string, any>
  metadata?: Record<string, any>
}

interface WorkflowAction {
  type: 'notification' | 'email' | 'webhook' | 'pause_campaign' | 'adjust_budget' | 'create_report'
  parameters: Record<string, any>
  delay?: number // delay em segundos
}

interface WorkflowStep {
  id: string
  name: string
  type: 'trigger' | 'condition' | 'action'
  config: WorkflowTrigger | WorkflowAction | any
  nextSteps: string[]
  position: { x: number; y: number }
}

interface Workflow {
  id: string
  organizationId: string
  name: string
  description: string
  isActive: boolean
  steps: WorkflowStep[]
  createdBy: string
  createdAt: Date
  updatedAt: Date
  executionCount: number
  lastExecuted?: Date
}

interface WorkflowExecution {
  id: string
  workflowId: string
  organizationId: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: Date
  completedAt?: Date
  currentStep?: string
  context: Record<string, any>
  logs: Array<{
    timestamp: Date
    step: string
    message: string
    level: 'info' | 'warning' | 'error'
    data?: any
  }>
}

export class WorkflowEngine {
  private supabase = createClient()
  private pushService = new PushService()
  private notificationService = new NotificationService()
  private runningExecutions = new Map<string, WorkflowExecution>()

  /**
   * Cria um novo workflow
   */
  async createWorkflow(
    organizationId: string,
    userId: string,
    workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>
  ): Promise<string> {
    const { data } = await this.supabase
      .from('workflows')
      .insert({
        organization_id: organizationId,
        name: workflow.name,
        description: workflow.description,
        is_active: workflow.isActive,
        steps: workflow.steps,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        execution_count: 0
      })
      .select('id')
      .single()

    return data?.id
  }

  /**
   * Atualiza um workflow existente
   */
  async updateWorkflow(
    workflowId: string,
    updates: Partial<Workflow>
  ): Promise<boolean> {
    try {
      await this.supabase
        .from('workflows')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', workflowId)

      return true
    } catch (error) {
      console.error('Failed to update workflow:', error)
      return false
    }
  }

  /**
   * Executa um workflow manualmente
   */
  async executeWorkflow(
    workflowId: string,
    context: Record<string, any> = {}
  ): Promise<string> {
    // Buscar workflow
    const { data: workflow } = await this.supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .single()

    if (!workflow || !workflow.is_active) {
      throw new Error('Workflow not found or inactive')
    }

    // Criar execução
    const executionId = this.generateExecutionId()
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      organizationId: workflow.organization_id,
      status: 'running',
      startedAt: new Date(),
      context,
      logs: []
    }

    this.runningExecutions.set(executionId, execution)

    // Executar em background
    this.runWorkflow(execution, workflow).catch(error => {
      console.error(`Workflow execution ${executionId} failed:`, error)
      execution.status = 'failed'
      execution.completedAt = new Date()
      this.logExecution(execution, 'error', 'Workflow execution failed', { error: error.message })
    })

    return executionId
  }

  /**
   * Executa workflow baseado em trigger
   */
  async triggerWorkflow(
    triggerType: string,
    triggerData: Record<string, any>,
    organizationId: string
  ): Promise<string[]> {
    // Buscar workflows que respondem a este trigger
    const { data: workflows } = await this.supabase
      .from('workflows')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)

    if (!workflows) return []

    const executionIds: string[] = []

    for (const workflow of workflows) {
      const triggerStep = workflow.steps.find((step: WorkflowStep) => 
        step.type === 'trigger' && step.config.type === triggerType
      )

      if (triggerStep && this.evaluateTriggerConditions(triggerStep.config, triggerData)) {
        try {
          const executionId = await this.executeWorkflow(workflow.id, {
            trigger: triggerData,
            triggerType
          })
          executionIds.push(executionId)
        } catch (error) {
          console.error(`Failed to trigger workflow ${workflow.id}:`, error)
        }
      }
    }

    return executionIds
  }

  /**
   * Executa um workflow completo
   */
  private async runWorkflow(execution: WorkflowExecution, workflow: any): Promise<void> {
    try {
      // Encontrar step inicial (trigger)
      const triggerStep = workflow.steps.find((step: WorkflowStep) => step.type === 'trigger')
      if (!triggerStep) {
        throw new Error('No trigger step found')
      }

      execution.currentStep = triggerStep.id
      this.logExecution(execution, 'info', 'Workflow started', { stepId: triggerStep.id })

      // Executar steps sequencialmente
      await this.executeStep(execution, workflow, triggerStep)

      execution.status = 'completed'
      execution.completedAt = new Date()
      this.logExecution(execution, 'info', 'Workflow completed')

      // Atualizar contador de execuções
      await this.supabase
        .from('workflows')
        .update({
          execution_count: workflow.execution_count + 1,
          last_executed: new Date().toISOString()
        })
        .eq('id', workflow.id)

    } catch (error) {
      execution.status = 'failed'
      execution.completedAt = new Date()
      this.logExecution(execution, 'error', 'Workflow failed', { error: error.message })
      throw error
    } finally {
      // Salvar log de execução
      await this.saveExecutionLog(execution)
    }
  }

  /**
   * Executa um step específico
   */
  private async executeStep(
    execution: WorkflowExecution,
    workflow: any,
    step: WorkflowStep
  ): Promise<void> {
    execution.currentStep = step.id
    this.logExecution(execution, 'info', `Executing step: ${step.name}`, { stepId: step.id })

    try {
      switch (step.type) {
        case 'trigger':
          // Trigger já foi processado, continuar para próximos steps
          break

        case 'condition':
          const conditionResult = await this.evaluateCondition(step.config, execution.context)
          this.logExecution(execution, 'info', `Condition result: ${conditionResult}`, { 
            stepId: step.id, 
            result: conditionResult 
          })
          
          if (!conditionResult) {
            // Se condição falhou, parar execução
            return
          }
          break

        case 'action':
          await this.executeAction(step.config, execution)
          break

        default:
          throw new Error(`Unknown step type: ${step.type}`)
      }

      // Executar próximos steps
      for (const nextStepId of step.nextSteps) {
        const nextStep = workflow.steps.find((s: WorkflowStep) => s.id === nextStepId)
        if (nextStep) {
          // Aplicar delay se configurado
          if (step.config.delay) {
            await this.sleep(step.config.delay * 1000)
          }
          
          await this.executeStep(execution, workflow, nextStep)
        }
      }

    } catch (error) {
      this.logExecution(execution, 'error', `Step failed: ${step.name}`, { 
        stepId: step.id, 
        error: error.message 
      })
      throw error
    }
  }

  /**
   * Avalia condições de trigger
   */
  private evaluateTriggerConditions(triggerConfig: WorkflowTrigger, data: Record<string, any>): boolean {
    switch (triggerConfig.type) {
      case 'metric_threshold':
        const { metric, operator, threshold } = triggerConfig.conditions
        const value = data[metric]
        return this.compareValues(value, operator, threshold)

      case 'campaign_status':
        return data.status === triggerConfig.conditions.status

      case 'schedule':
        // Para triggers de schedule, sempre retornar true (já foi filtrado pelo cron)
        return true

      case 'webhook':
        // Para webhooks, verificar se contém dados esperados
        return Object.keys(triggerConfig.conditions).every(key => 
          data[key] !== undefined
        )

      case 'manual':
        return true

      default:
        return false
    }
  }

  /**
   * Avalia uma condição
   */
  private async evaluateCondition(conditionConfig: any, context: Record<string, any>): Promise<boolean> {
    const { type, conditions } = conditionConfig

    switch (type) {
      case 'metric_comparison':
        const { metric, operator, value } = conditions
        const contextValue = context[metric]
        return this.compareValues(contextValue, operator, value)

      case 'time_range':
        const now = new Date()
        const { startTime, endTime } = conditions
        const start = new Date(`1970-01-01T${startTime}:00`)
        const end = new Date(`1970-01-01T${endTime}:00`)
        const current = new Date(`1970-01-01T${now.getHours()}:${now.getMinutes()}:00`)
        return current >= start && current <= end

      case 'day_of_week':
        const dayOfWeek = new Date().getDay()
        return conditions.days.includes(dayOfWeek)

      default:
        return true
    }
  }

  /**
   * Executa uma ação
   */
  private async executeAction(actionConfig: WorkflowAction, execution: WorkflowExecution): Promise<void> {
    switch (actionConfig.type) {
      case 'notification':
        await this.executeNotificationAction(actionConfig, execution)
        break

      case 'email':
        await this.executeEmailAction(actionConfig, execution)
        break

      case 'webhook':
        await this.executeWebhookAction(actionConfig, execution)
        break

      case 'pause_campaign':
        await this.executePauseCampaignAction(actionConfig, execution)
        break

      case 'adjust_budget':
        await this.executeAdjustBudgetAction(actionConfig, execution)
        break

      case 'create_report':
        await this.executeCreateReportAction(actionConfig, execution)
        break

      default:
        throw new Error(`Unknown action type: ${actionConfig.type}`)
    }
  }

  /**
   * Executa ação de notificação
   */
  private async executeNotificationAction(actionConfig: WorkflowAction, execution: WorkflowExecution): Promise<void> {
    const { title, message, priority, type } = actionConfig.parameters

    await this.notificationService.createNotification({
      organizationId: execution.organizationId,
      type: type || 'workflow_action',
      title,
      message,
      priority: priority || 'medium',
      metadata: {
        workflowId: execution.workflowId,
        executionId: execution.id
      }
    })

    this.logExecution(execution, 'info', 'Notification sent', { title, message })
  }

  /**
   * Executa ação de email
   */
  private async executeEmailAction(actionConfig: WorkflowAction, execution: WorkflowExecution): Promise<void> {
    const { to, subject, template, data } = actionConfig.parameters

    const emailTemplate = this.pushService.getEmailTemplate(template)
    const success = await this.pushService.sendEmail(to, {
      subject,
      html: emailTemplate.html,
      text: emailTemplate.text
    }, data)

    this.logExecution(execution, success ? 'info' : 'error', 'Email action executed', { 
      to, 
      subject, 
      success 
    })
  }

  /**
   * Executa ação de webhook
   */
  private async executeWebhookAction(actionConfig: WorkflowAction, execution: WorkflowExecution): Promise<void> {
    const { url, method, headers, body } = actionConfig.parameters

    try {
      const response = await fetch(url, {
        method: method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({
          ...body,
          workflowId: execution.workflowId,
          executionId: execution.id,
          context: execution.context
        })
      })

      const success = response.ok
      this.logExecution(execution, success ? 'info' : 'warning', 'Webhook action executed', { 
        url, 
        status: response.status,
        success 
      })
    } catch (error) {
      this.logExecution(execution, 'error', 'Webhook action failed', { 
        url, 
        error: error.message 
      })
    }
  }

  /**
   * Executa ação de pausar campanha
   */
  private async executePauseCampaignAction(actionConfig: WorkflowAction, execution: WorkflowExecution): Promise<void> {
    const { campaignId } = actionConfig.parameters

    // Aqui você implementaria a lógica para pausar a campanha via Meta API
    // Por enquanto, apenas log
    this.logExecution(execution, 'info', 'Campaign pause action executed', { campaignId })
  }

  /**
   * Executa ação de ajustar orçamento
   */
  private async executeAdjustBudgetAction(actionConfig: WorkflowAction, execution: WorkflowExecution): Promise<void> {
    const { campaignId, newBudget, adjustmentType } = actionConfig.parameters

    // Aqui você implementaria a lógica para ajustar orçamento via Meta API
    // Por enquanto, apenas log
    this.logExecution(execution, 'info', 'Budget adjustment action executed', { 
      campaignId, 
      newBudget, 
      adjustmentType 
    })
  }

  /**
   * Executa ação de criar relatório
   */
  private async executeCreateReportAction(actionConfig: WorkflowAction, execution: WorkflowExecution): Promise<void> {
    const { reportType, recipients } = actionConfig.parameters

    // Aqui você implementaria a lógica para gerar e enviar relatório
    // Por enquanto, apenas log
    this.logExecution(execution, 'info', 'Report creation action executed', { 
      reportType, 
      recipients 
    })
  }

  /**
   * Compara valores com operador
   */
  private compareValues(value: any, operator: string, threshold: any): boolean {
    const numValue = parseFloat(value)
    const numThreshold = parseFloat(threshold)

    switch (operator) {
      case 'greater_than':
        return numValue > numThreshold
      case 'less_than':
        return numValue < numThreshold
      case 'equals':
        return numValue === numThreshold
      case 'greater_than_or_equal':
        return numValue >= numThreshold
      case 'less_than_or_equal':
        return numValue <= numThreshold
      case 'not_equals':
        return numValue !== numThreshold
      default:
        return false
    }
  }

  /**
   * Adiciona log à execução
   */
  private logExecution(
    execution: WorkflowExecution,
    level: 'info' | 'warning' | 'error',
    message: string,
    data?: any
  ): void {
    execution.logs.push({
      timestamp: new Date(),
      step: execution.currentStep || 'unknown',
      message,
      level,
      data
    })
  }

  /**
   * Salva log de execução no banco
   */
  private async saveExecutionLog(execution: WorkflowExecution): Promise<void> {
    await this.supabase
      .from('workflow_executions')
      .insert({
        id: execution.id,
        workflow_id: execution.workflowId,
        organization_id: execution.organizationId,
        status: execution.status,
        started_at: execution.startedAt.toISOString(),
        completed_at: execution.completedAt?.toISOString(),
        context: execution.context,
        logs: execution.logs
      })
  }

  /**
   * Obtém status de execução
   */
  getExecutionStatus(executionId: string): WorkflowExecution | null {
    return this.runningExecutions.get(executionId) || null
  }

  /**
   * Lista execuções em andamento
   */
  getRunningExecutions(): WorkflowExecution[] {
    return Array.from(this.runningExecutions.values())
  }

  /**
   * Cancela execução
   */
  cancelExecution(executionId: string): boolean {
    const execution = this.runningExecutions.get(executionId)
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled'
      execution.completedAt = new Date()
      this.logExecution(execution, 'info', 'Execution cancelled by user')
      return true
    }
    return false
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

export default WorkflowEngine