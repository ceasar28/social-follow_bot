import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as TelegramBot from 'node-telegram-bot-api';
import { TwitterAccount } from './schemas/twitter.accounts.schema';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { User } from './schemas/users.schema';
import { TiktokAccount } from './schemas/tiktok.accounts.schema';
import { welcomeMessageMarkup } from './markups';

const token = process.env.TEST_TOKEN;

@Injectable()
export class SocialBotService {
  private readonly trackerBot: TelegramBot;
  private logger = new Logger(SocialBotService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(TwitterAccount.name)
    private readonly TwitterAccountModel: Model<TwitterAccount>,
    @InjectModel(TiktokAccount.name)
    private readonly TiktokAccountModel: Model<TiktokAccount>,
    @InjectModel(User.name) private readonly UserModel: Model<User>,
  ) {
    this.trackerBot = new TelegramBot(token, { polling: true });
    this.trackerBot.on('message', this.handleRecievedMessages);
    this.trackerBot.on('callback_query', this.handleButtonCommands);
  }

  handleRecievedMessages = async (
    msg: TelegramBot.Message,
  ): Promise<unknown> => {
    this.logger.debug(msg);
    try {
      await this.trackerBot.sendChatAction(msg.chat.id, 'typing');
      if (msg.text.trim() === '/start') {
        const username: string = `${msg.from.username}`;
        const welcome = await welcomeMessageMarkup(username);
        const replyMarkup = {
          inline_keyboard: welcome.keyboard,
        };
        return await this.trackerBot.sendMessage(msg.chat.id, welcome.message, {
          reply_markup: replyMarkup,
        });
      }
    } catch (error) {
      console.log(error);
      return await this.trackerBot.sendMessage(
        msg.chat.id,
        'There was an error processing your message',
      );
    }
  };

  handleButtonCommands = async (
    query: TelegramBot.CallbackQuery,
  ): Promise<unknown> => {
    this.logger.debug(query);
    let command: string;

    // const username = `${query.from.username}`;
    const chatId = query.message.chat.id;

    // function to check if query.data is a json type
    function isJSON(str: string) {
      try {
        JSON.parse(str);
        return true;
      } catch (e) {
        console.log(e);
        return false;
      }
    }

    if (isJSON(query.data)) {
      command = JSON.parse(query.data).command;
    } else {
      command = query.data;
    }

    try {
      console.log(command);
      switch (command) {
        // case '/track':
        //   await this.trackerBot.sendChatAction(chatId, 'typing');
        //   return await this.sendTransactionDetails(chatId);

        case '/track':
          await this.trackerBot.sendChatAction(chatId, 'typing');
          console.log('hey');
          const userExist = await this.UserModel.findOne({
            userChatId: chatId,
          });
          if (!userExist) {
            const savedUser = new this.UserModel({ userChatId: chatId });
            return savedUser.save();
          }
          return userExist;
        // setInterval(() => {
        //   this.queryBlockchain();
        // }, 60000); // Run every 60 seconds
        // return await this.queryBlockchain();

        default:
          return await this.trackerBot.sendMessage(
            chatId,
            'There was an error processing your message',
          );
      }
    } catch (error) {
      console.log(error);
      return await this.trackerBot.sendMessage(
        chatId,
        'There was an error processing your message',
      );
    }
  };
}
