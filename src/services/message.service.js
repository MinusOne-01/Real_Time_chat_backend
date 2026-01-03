export async function saveMessage(prisma, {
  roomId,
  senderId,
  content,
}) {
  return prisma.message.create({
    data: {
      room_id: roomId,
      sender_id: senderId,
      content,
    },
  });
}

