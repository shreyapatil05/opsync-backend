import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';


export const getMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId)
      .populate('sender', 'name avatar')
      .populate('replyTo', 'content sender messageType')
      .populate('replyTo.sender', 'name avatar')
      .populate('reactions.user', 'name avatar');

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    
    const conversation = await Conversation.findOne({
      _id: message.conversationId,
      participants: req.user.id
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Access denied to this message' });
    }

    res.json(message);
  } catch (error) {
    console.error('Error getting message:', error);
    res.status(500).json({ error: 'Failed to get message' });
  }
};


export const updateMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.sender.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Can only edit your own messages' });
    }

    const timeDiff = Date.now() - message.createdAt.getTime();
    const editTimeLimit = 15 * 60 * 1000; 

    if (timeDiff > editTimeLimit) {
      return res.status(400).json({ error: 'Message can no longer be edited' });
    }

   
    message.content = content;
    message.isEdited = true;
    await message.save();

    await message.populate('sender', 'name avatar');
    await message.populate('replyTo', 'content sender messageType');
    await message.populate('replyTo.sender', 'name avatar');

    if (req.app.get('io')) {
      req.app.get('io').to(message.conversationId.toString()).emit('message_updated', {
        message,
        conversationId: message.conversationId
      });
    }

    res.json(message);
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
};


export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

   
    const conversation = await Conversation.findOne({
      _id: message.conversationId,
      participants: req.user.id
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const isSender = message.sender.toString() === req.user.id;
    const isAdmin = conversation.createdBy.toString() === req.user.id;

    if (!isSender && !isAdmin) {
      return res.status(403).json({ error: 'Can only delete your own messages' });
    }

    const conversationId = message.conversationId;
    
    
    await Message.findByIdAndDelete(messageId);

   
    if (conversation.lastMessage && conversation.lastMessage.toString() === messageId) {
      const newLastMessage = await Message.findOne(
        { conversationId },
        {},
        { sort: { createdAt: -1 } }
      );
      
      conversation.lastMessage = newLastMessage ? newLastMessage._id : null;
      await conversation.save();
    }

    
    if (req.app.get('io')) {
      req.app.get('io').to(conversationId.toString()).emit('message_deleted', {
        messageId,
        conversationId
      });
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
};


export const markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const conversation = await Conversation.findOne({
      _id: message.conversationId,
      participants: req.user.id
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!message.readBy.includes(req.user.id)) {
      message.readBy.push(req.user.id);
      await message.save();
    }

    res.json({ message: 'Message marked as read' });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
};


export const addReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const conversation = await Conversation.findOne({
      _id: message.conversationId,
      participants: req.user.id
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Access denied' });
    }

   
    message.reactions = message.reactions.filter(
      reaction => reaction.user.toString() !== req.user.id
    );

    
    message.reactions.push({
      user: req.user.id,
      emoji,
      createdAt: new Date()
    });

    await message.save();
    await message.populate('reactions.user', 'name avatar');

   
    if (req.app.get('io')) {
      req.app.get('io').to(message.conversationId.toString()).emit('reaction_added', {
        messageId,
        reactions: message.reactions,
        conversationId: message.conversationId
      });
    }

    res.json(message.reactions);
  } catch (error) {
    console.error('Error adding reaction:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
};


export const removeReaction = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const conversation = await Conversation.findOne({
      _id: message.conversationId,
      participants: req.user.id
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Access denied' });
    }

   
    message.reactions = message.reactions.filter(
      reaction => reaction.user.toString() !== req.user.id
    );

    await message.save();
    await message.populate('reactions.user', 'name avatar');

   
    if (req.app.get('io')) {
      req.app.get('io').to(message.conversationId.toString()).emit('reaction_removed', {
        messageId,
        reactions: message.reactions,
        conversationId: message.conversationId
      });
    }

    res.json(message.reactions);
  } catch (error) {
    console.error('Error removing reaction:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
};