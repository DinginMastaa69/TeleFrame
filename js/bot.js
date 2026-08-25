const { Telegraf } = require("telegraf");
const { message, anyOf } = require("telegraf/filters");
const download = require("image-downloader");
const moment = require("moment");
const exec = require("child_process").exec;
const fs = require(`fs`);
const path = require("path");
const botReply = require('./botReply');

// file types TeleFrame is able to display
const SUPPORTED_TYPES = /\.(mp4|jpg|jpeg|gif|png)$/i;

var Bot = class {
  constructor(
    imageWatchdog,
    logger,
    config
  ) {
    this.bot = new Telegraf(config.botToken);
    // Telegraf 4 exposes the Telegram API client on the bot instance,
    // a separate `new Telegram(token)` is no longer needed.
    this.telegram = this.bot.telegram;
    this.logger = logger;
    this.imageWatchdog = imageWatchdog;
    this.config = config;

    //Welcome message on bot start
    this.bot.start((ctx) => botReply(ctx, 'welcome'));

    //Help message
    this.bot.help((ctx) => botReply(ctx, 'help'));


    //Middleware Check for whitelisted  ChatID
    const isChatWhitelisted = (ctx, next) => {
      if (
        (
          config.whitelistChats.length > 0 &&
          config.whitelistChats.indexOf(ctx.message.chat.id) == -1
        )
      ){
        this.logger.info(
          "Whitelist triggered:",
          ctx.message.chat.id,
          config.whitelistChats,
          config.whitelistChats.indexOf(ctx.message.chat.id)
        );
        botReply(ctx, 'whitelistInfo');

        //Break if Chat is not whitelisted
        return ;
      }

      return next();
    }


    //Middleware Check for whitelisted  ChatID
    const isAdminWhitelisted = (ctx, next) => {
      if (
          config.whitelistAdmins.indexOf(ctx.message.chat.id) == -1
      ){
        this.logger.info(
          "Admin-Whitelist triggered:",
          ctx.message.chat.id,
          config.whitelistAdmins,
          config.whitelistAdmins.indexOf(ctx.message.chat.id)
        );
        botReply(ctx, 'whitelistAdminInfo');

        //Break if Chat is not whitelisted
        return ;
      }

      return next();
    }

    // anyOf(...), not message('photo', 'video', 'document'): a filter built from
    // several keys requires the message to carry *all* of them, so a single
    // message() call with three keys matches nothing at all. Telegraf 3's
    // array form was an OR, this is the equivalent.
    const isAsset = anyOf(message('photo'), message('video'), message('document'));

    //Download incoming assets
    this.bot.on(isAsset, isChatWhitelisted, (ctx) => {
      // Telegraf 4 removed ctx.updateSubTypes, the message itself tells us
      // which kind of asset arrived.
      let fileId;
      if (ctx.message.photo) {
        fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      } else if (ctx.message.video) {
        fileId = ctx.message.video.file_id
      } else if (ctx.message.document) {
        fileId = ctx.message.document.file_id;
      }


      this.telegram.getFileLink(fileId).then((link) => {
        // Telegraf 4 resolves getFileLink to a URL object instead of a string
        const fileUrl = link.href;
        // check for supported file types
        if (link.pathname.match(SUPPORTED_TYPES) === null) {
          if (config.botReply) {
            botReply(ctx, 'documentFormatError');
          }
          return;
        }

        let fileExtension = '.' + link.pathname.split('.').pop().toLowerCase();

        if (fileExtension !== '.mp4' || config.showVideos) {
          // Path handling, and why it looks like this:
          // image-downloader 4 resolves a relative dest against its *own*
          // package directory, so passing "images/1234.jpg" writes to
          // node_modules/image-downloader/images/ and fails with ENOENT.
          // Give it an absolute path, but keep storing the relative one - the
          // rest of TeleFrame (imageWatchdog's images.json, autoDeleteImage,
          // and the <img src> in the renderer) is relative to the working
          // directory, and images.json should stay portable.
          const imagePath = config.imageFolder + "/" + moment().format("x") + fileExtension;

          download
            .image({
              url: fileUrl,
              dest: path.resolve(imagePath)
            })
            .then(({ filename, image }) => {
              var chatName = ''
              if (ctx.message.chat.type == 'group') {
                chatName = ctx.message.chat.title;
              } else if (ctx.message.chat.type == 'private') {
                chatName = ctx.message.from.first_name;
              }
              this.newImage(
                imagePath,
                ctx.message.from.first_name,
                ctx.message.caption,
                ctx.message.chat.id,
                chatName,
                ctx.message.message_id
              );
              // let bot reply, if wanted and Download was successful
              if (config.botReply) {
                if (fileExtension.match(/\.(mp4|gif)$/)){
                  botReply(ctx, 'videoReceived');
                } else if (fileExtension.match(/\.(jpg|jpeg|png)$/)){
                  botReply(ctx, 'imageReceived');
                }
              }
            })
            .catch((err) => {
              this.logger.error(err.stack);
            });
          }else{
            if (config.botReply) {
              botReply(ctx, 'videoReceivedError');
			}
		  }
        })
        .catch((err) => {
          this.logger.error('Download: ' + err.stack);
          ctx.reply('Sorry: ' + err.toString());
        });
    });

    this.bot.catch((err) => {
      this.logger.error(err.stack);
    });

    //Some small conversation
    this.bot.hears(/^hi/i, (ctx) => {
      botReply(ctx, 'hiReply', ctx.chat.first_name, ctx.chat.id);
      this.logger.info(ctx.chat);
    });


    //Add Admin Actions from config to Bot-Command
    if(this.config.adminAction.allowAdminAction ){
      var actions = this.config.adminAction.actions;
      this.logger.info("Add Admin-Actions");

      actions.forEach(action => {
        //only add action if comman isn't (empty or null) and action is enabled
        if(!!action.command && action.enable){
        this.bot.command(action.name, isAdminWhitelisted, (ctx) => {
          this.logger.warn("Command received: "+action.name);
          this.logger.warn(action.command);
          botReply(ctx, 'adminActionTriggered', action.name);

          exec(action.command, (error, stdout, stderr) => {
            if (error) {
              console.error(stderr);
              botReply(ctx, 'adminActionError', action.name, error.code, stderr);
              return;
            }

            console.log(stdout)
            botReply(ctx, 'adminActionSuccess', action.name, stdout);
          });
        })

        }
      });

    }

    this.logger.info("Bot created!");
  }



  startBot() {
    // Telegraf 4: startPolling() is private, launch() is the public entry point.
    // The returned promise only settles when the bot stops, so a rejection
    // means polling could not be started (e.g. no network yet at boot time).
    this.bot
      .launch({ dropPendingUpdates: false }, () => {
        this.logger.info("Using bot with name " + this.bot.botInfo.username + ".");
        this.logger.info("Bot started!");
      })
      .catch((err) => {
        this.logger.error("Bot could not be started: " + (err.stack || err));
        this.logger.info("Retrying in 30 seconds ...");
        setTimeout(() => this.startBot(), 30000);
      });
  }

  stopBot(reason) {
    // Stops long polling so restarts do not leave a dangling getUpdates
    // connection behind. Throws when the bot was never launched.
    try {
      this.bot.stop(reason);
      this.logger.info("Bot stopped.");
    } catch (err) {
      this.logger.warn("Bot was not running: " + err.message);
    }
  }

  newImage(src, sender, caption, chatId, chatName, messageId) {
    //tell imageWatchdog that a new image arrived
    this.imageWatchdog.newImage(src, sender, caption, chatId, chatName, messageId);
  }

  sendMessage(text) {
    // function to send messages, used for whitlist handling
    return this.telegram.sendMessage(this.config.whitelistChats[0], text);
  }

  sendAudio(filename, chatId, messageId) {
    // function to send recorded audio as voice reply
    fs.readFile(
      filename,
      function(err, data) {
        if (err) {
          this.logger.error(err);
          return;
        }
          this.telegram
            .sendVoice(chatId, {
              source: data
            }, {
              // reply_to_message_id was replaced by reply_parameters in Bot API 7.0
              reply_parameters: {
                message_id: messageId
              }
            })
            .then(() => {
              this.logger.info("success");
            })
            .catch((err) => {
              this.logger.error("error", err);
            });

      }.bind(this)
    );
  }

};

/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== "undefined") {
  module.exports = Bot;
}
