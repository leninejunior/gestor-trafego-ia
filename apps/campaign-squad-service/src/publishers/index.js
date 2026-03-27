const { publishToMeta } = require('./meta-publisher');
const { publishToGoogle } = require('./google-publisher');

async function publishChannel({ channel, run, supabase, appDashboardUrl }) {
  if (channel === 'meta') {
    return publishToMeta({ run, supabase, appDashboardUrl });
  }

  if (channel === 'google') {
    return publishToGoogle({ run, supabase, appDashboardUrl });
  }

  throw new Error(`Unsupported publish channel: ${channel}`);
}

module.exports = {
  publishChannel
};

