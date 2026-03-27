const IORedis = require('ioredis');
const { Queue, Worker } = require('bullmq');

class QueueOrchestrator {
  constructor({ redisUrl, handlers }) {
    this.redisUrl = redisUrl;
    this.handlers = handlers;
    this.onDlq = handlers.onDlq || null;
    this.useInMemory = !redisUrl;
    this.queue = null;
    this.dlq = null;
    this.worker = null;
    this.connection = null;
  }

  async init() {
    if (this.useInMemory) {
      return;
    }

    this.connection = new IORedis(this.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true
    });

    this.queue = new Queue('campaign-squad-jobs', {
      connection: this.connection
    });

    this.dlq = new Queue('campaign-squad-dlq', {
      connection: this.connection
    });

    this.worker = new Worker(
      'campaign-squad-jobs',
      async (job) => {
        try {
          if (job.name === 'planning') {
            await this.handlers.handlePlanning(job.data.runId);
            return;
          }

          if (job.name === 'creative') {
            await this.handlers.handleCreative(job.data.runId, job.data.refineReason || null);
            return;
          }

          if (job.name === 'publish') {
            await this.handlers.handlePublish(job.data.runId);
            return;
          }

          if (job.name === 'qa') {
            await this.handlers.handleQa(job.data.runId);
            return;
          }

          throw new Error(`Unsupported job type: ${job.name}`);
        } catch (error) {
          await this.enqueueDlq({
            jobName: job.name,
            payload: job.data,
            reason: error instanceof Error ? error.message : 'Unknown worker error'
          });
          throw error;
        }
      },
      {
        connection: this.connection,
        concurrency: 3
      }
    );
  }

  async enqueue(type, data) {
    if (this.useInMemory) {
      setTimeout(async () => {
        try {
          if (type === 'planning') {
            await this.handlers.handlePlanning(data.runId);
            return;
          }

          if (type === 'creative') {
            await this.handlers.handleCreative(data.runId, data.refineReason || null);
            return;
          }

          if (type === 'publish') {
            await this.handlers.handlePublish(data.runId);
            return;
          }

          if (type === 'qa') {
            await this.handlers.handleQa(data.runId);
            return;
          }
        } catch (error) {
          await this.enqueueDlq({
            jobName: type,
            payload: data,
            reason: error instanceof Error ? error.message : 'Unknown worker error'
          });
        }
      }, 15);
      return;
    }

    await this.queue.add(type, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000
      },
      removeOnComplete: true,
      removeOnFail: false
    });
  }

  async enqueueDlq(payload) {
    if (this.onDlq) {
      try {
        this.onDlq(payload);
      } catch (_error) {
        // no-op
      }
    }

    if (this.useInMemory || !this.dlq) {
      return;
    }

    await this.dlq.add('failed-job', payload, {
      removeOnComplete: true,
      removeOnFail: false
    });
  }
}

module.exports = {
  QueueOrchestrator
};

