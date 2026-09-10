import amqp, { type Channel, type ChannelModel } from 'amqplib';
import { getRabbitMqUrl } from './env';
import { DLQ_SUFFIX, DLX, EXCHANGE, QUEUES } from './queues';

type Connection = { model: ChannelModel; channel: Channel };

let connection: Connection | null = null;
let connecting: Promise<Connection> | null = null;

const ALL_QUEUES = Object.values(QUEUES);

async function assertTopology(channel: Channel) {
  await channel.assertExchange(EXCHANGE, 'direct', { durable: true });
  await channel.assertExchange(DLX, 'direct', { durable: true });

  for (const queue of ALL_QUEUES) {
    const deadLetter = `${queue}${DLQ_SUFFIX}`;
    await channel.assertQueue(deadLetter, { durable: true });
    await channel.bindQueue(deadLetter, DLX, queue);
    await channel.assertQueue(queue, {
      durable: true,
      deadLetterExchange: DLX,
      deadLetterRoutingKey: queue,
    });
    await channel.bindQueue(queue, EXCHANGE, queue);
  }
}

async function open(): Promise<Connection> {
  const url = getRabbitMqUrl();
  if (!url) throw new Error('RABBITMQ_URL não configurado.');

  const model = await amqp.connect(url, { heartbeat: 20 });
  const channel = await model.createChannel();
  await assertTopology(channel);

  const drop = () => {
    if (connection?.model === model) connection = null;
    connecting = null;
  };
  model.on('close', drop);
  model.on('error', drop);

  return { model, channel };
}

export async function getRabbitChannel(): Promise<Channel> {
  if (connection) return connection.channel;
  if (!connecting) {
    connecting = open()
      .then((next) => {
        connection = next;
        connecting = null;
        return next;
      })
      .catch((error) => {
        connecting = null;
        throw error;
      });
  }
  const ready = await connecting;
  return ready.channel;
}

export function isQueueConfigured() {
  return Boolean(getRabbitMqUrl());
}

export async function publish(queue: string, payload: unknown, options: { messageId?: string } = {}) {
  const channel = await getRabbitChannel();
  return channel.publish(EXCHANGE, queue, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
    contentType: 'application/json',
    timestamp: Date.now(),
    ...(options.messageId ? { messageId: options.messageId } : {}),
  });
}

export async function publishSafe(queue: string, payload: unknown, options: { messageId?: string } = {}) {
  if (!isQueueConfigured()) return false;
  try {
    return await publish(queue, payload, options);
  } catch (error) {
    console.error(`[rabbitmq] publish falhou em ${queue}:`, error);
    return false;
  }
}

export async function closeRabbit() {
  const current = connection;
  connection = null;
  connecting = null;
  if (!current) return;
  try {
    await current.channel.close();
  } catch {}
  try {
    await current.model.close();
  } catch {}
}
