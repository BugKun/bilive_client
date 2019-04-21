import { EventEmitter } from 'events'
import { Options as requestOptions } from 'request'
import { tools, AppClient } from '../../plugin'
import Options from '../../options'

/**
 * 自动参与抽奖
 *
 * @class Raffle
 */
class Raffle extends EventEmitter {
  /**
   * 创建一个 Raffle 实例
   * @param {raffleMessage | lotteryMessage | beatStormMessage | boxMessage} raffleMessage
   * @memberof Raffle
   */
  constructor(raffleMessage: raffleMessage | lotteryMessage | beatStormMessage | boxMessage, user: User) {
    super()
    this._raffleMessage = raffleMessage
    this._user = user
  }
  /**
   * 抽奖设置
   *
   * @private
   * @type {raffleMessage | lotteryMessage}
   * @memberof Raffle
   */
  private _raffleMessage: raffleMessage | lotteryMessage | beatStormMessage | boxMessage
  /**
   * 抽奖用户
   *
   * @private
   * @type {User}
   * @memberof Raffle
   */
  private _user: User
  /**
   * 抽奖地址
   *
   * @private
   * @type {string}
   * @memberof Raffle
   */
  private _url!: string
  /**
   * 开始抽奖
   *
   * @memberof Raffle
   */
  public async Start() {
    switch (this._raffleMessage.cmd) {
      case 'smallTV':
        this._url = 'https://api.live.bilibili.com/gift/v4/smalltv'
        this._Raffle()
        break
      case 'raffle':
        this._url = 'https://api.live.bilibili.com/gift/v4/smalltv'
        this._Raffle()
        break
      case 'lottery':
        this._url = 'https://api.live.bilibili.com/lottery/v2/lottery'
        this._Lottery()
        break
      case 'beatStorm':
        this._url = 'https://api.live.bilibili.com/lottery/v1/Storm'
        this._BeatStorm()
        break
      case 'box':
        this._url = 'https://api.live.bilibili.com/lottery/v1/Box'
        this._BoxDraw()
        break
      default: break
    }
  }
  /**
   * Raffle类抽奖
   *
   * @private
   * @memberof Raffle
   */
  private async _Raffle() {
    await tools.Sleep((<raffleMessage>this._raffleMessage).time_wait * 1000)
    this._RaffleAward()
  }
  /**
   * 获取抽奖结果
   *
   * @private
   * @memberof Raffle
   */
  private async _RaffleAward() {
    const { cmd, id, roomID, title, type } = <raffleMessage>this._raffleMessage
    const reward: requestOptions = {
      method: 'POST',
      uri: `${this._url}/getAward`,
      body: AppClient.signQueryBase(`${this._user.tokenQuery}&raffleId=${id}&roomid=${roomID}&type=${type}`),
      json: true,
      headers: this._user.headers
    }
    tools.XHR<raffleAward>(reward, 'Android').then(raffleAward => {
      if (raffleAward !== undefined && raffleAward.response.statusCode === 200) {
        if (raffleAward.body.code === 0) {
          const gift = raffleAward.body.data
          if (gift.gift_num === 0) tools.Log(this._user.nickname, title, id, raffleAward.body.msg)
          if (gift.gift_num === undefined) {
            tools.Log(raffleAward.body)
            tools.sendSCMSG(raffleAward.body.toString())
          }
          else {
            const msg = `${this._user.nickname} ${title} ${id} 获得 ${gift.gift_num} 个${gift.gift_name}`
            this.emit('msg', {
              cmd: 'earn',
              data: { uid: this._user.uid, nickname: this._user.nickname, type: cmd, name: gift.gift_name, num: gift.gift_num }
            })
            tools.Log(msg)
            if (gift.gift_name.includes('小电视')) tools.sendSCMSG(msg)
          }
        }
        else tools.Log(this._user.nickname, title, id, raffleAward.body)
        if (raffleAward.body.msg === '访问被拒绝') 
          this.emit('msg', { cmd: 'ban', data: { uid: this._user.uid, type: 'raffle', nickname: this._user.nickname } })
      }
    })
  }
  /**
   * Lottery类抽奖
   *
   * @private
   * @memberof Raffle
   */
  private async _Lottery() {
    const { id, roomID, title, type } = <lotteryMessage>this._raffleMessage
    const reward: requestOptions = {
      method: 'POST',
      uri: `${this._url}/join`,
      body: AppClient.signQueryBase(`${this._user.tokenQuery}&id=${id}&roomid=${roomID}&type=${type}`),
      json: true,
      headers: this._user.headers
    }
    tools.XHR<lotteryReward>(reward, 'Android').then(lotteryReward => {
      if (lotteryReward !== undefined && lotteryReward.response.statusCode === 200) {
        if (lotteryReward.body.code === 0) {
          let data = lotteryReward.body.data
          let type = data.privilege_type
          this.emit('msg', {
            cmd: 'earn',
            data: {
              uid: this._user.uid,
              nickname: this._user.nickname,
              type: 'lottery',
              name: data.message.includes('辣条X') ? '辣条' : '亲密度',
              num: (type === 1 ? 20 : (type === 2 ? 5 : 1))
            }
          })
          tools.Log(this._user.nickname, title, id, data.message)
        }
        else tools.Log(this._user.nickname, title, id, lotteryReward.body)
        if (lotteryReward.body.msg === '访问被拒绝') 
          this.emit('msg', { cmd: 'ban', data: { uid: this._user.uid, type: 'raffle', nickname: this._user.nickname } })
      }
    })
  }
  /**
   * 节奏风暴
   *
   * @private
   * @memberof Raffle
   */
  private async _BeatStorm() {
    const { id, roomID, title } = this._raffleMessage
    const join: requestOptions = {
      method: 'POST',
      uri: `${this._url}/join`,
      body: AppClient.signQuery(`${this._user.tokenQuery}&${AppClient.baseQuery}&id=${id}&roomid=${roomID}`),
      json: true,
      headers: this._user.headers
    }
    let num: number = 1
    if ((<beatStormMessage>this._raffleMessage).num !== undefined)
      num = (<beatStormMessage>this._raffleMessage).num
    if (<number[]>Options._.advConfig.stormSetting === undefined) return
    for (let i = 1; i <= (<number[]>Options._.advConfig.stormSetting)[1] * num; i++) {
      let joinStorm = await tools.XHR<joinStorm>(join, 'Android')
      if (joinStorm === undefined) break
      if (joinStorm.response.statusCode !== 200) {
        tools.Log(this._user.nickname, title, id, joinStorm.response.statusCode)
        break
      }
      if (joinStorm.body.code === 0) {
        const content = joinStorm.body.data
        if (content !== undefined && content.gift_num > 0) {
          tools.Log(this._user.nickname, title, id, `第${i}次尝试`, `${content.mobile_content} 获得 ${content.gift_num} 个${content.gift_name}`)
          this.emit('msg', { cmd: 'earn', data: { uid: this._user.uid, nickname: this._user.nickname, type: 'beatStorm', name: content.gift_name, num: content.gift_num } })
          break
        }
      }
      else tools.Log(this._user.nickname, title, id, `第${i}次尝试`, joinStorm.body.msg)
      if (joinStorm.body.msg === '访问被拒绝') {
        this.emit('msg', { cmd: 'ban', data: { uid: this._user.uid, type: 'beatStorm', nickname: this._user.nickname } })
        break
      }
      else if (joinStorm.body.msg === '已经领取奖励') break
      if (joinStorm.body.msg === '你错过了奖励，下次要更快一点哦~') this.emit('msg', { cmd: 'unban', data: { uid: this._user.uid, type: 'beatStorm', nickname: this._user.nickname } })
      await tools.Sleep((<number[]>Options._.advConfig.stormSetting)[0])
    }
  }
  /**
   * 参与实物宝箱抽奖
   *
   * @private
   * @memberof Raffle
   */
  private async _BoxDraw() {
    const { id, round, title } = <boxMessage>this._raffleMessage
    const draw: requestOptions = {
      uri: `${this._url}/draw?${AppClient.signQueryBase(`${this._user.tokenQuery}&aid=${id}&number=${round}`)}`,
      json: true,
      headers: this._user.headers
    }
    tools.XHR<boxDraw>(draw, 'Android').then(drawResult => {
      if (drawResult !== undefined && drawResult.response.statusCode === 200) {
		tools.sendSCMSG(JSON.stringify(drawResult.body))
        if (drawResult.body.code === 0) this._BoxAward()
        else tools.Log(this._user.nickname, title, id, drawResult.body)
      }
    })
  }
  /**
   * 实物宝箱
   *
   * @private
   * @memberof Raffle
   */
  private async _BoxAward() {
    const { id, round, title, endTime } = <boxMessage>this._raffleMessage
    await tools.Sleep(<number>endTime * 1e3 - Date.now())
    const getReward: requestOptions = {
      uri: `${this._url}/getDrawRewardByType?${AppClient.signQueryBase(`${this._user.tokenQuery}&aid=${id}&number=${round}`)}`,
      json: true,
      headers: this._user.headers
    }
    tools.XHR<boxReward>(getReward, 'Android').then(reward => {
      if (reward !== undefined && reward.response.statusCode === 200) {
		 tools.sendSCMSG(JSON.stringify(reward.body))
        if (reward.body.code === 0) tools.Log(this._user.nickname, title, id, reward.body.msg)
        else tools.Log(this._user.nickname, title, id, reward.body.msg)
      }
    })
  }
}

/**
 * 抽奖结果信息
 *
 * @interface raffleReward
 */
interface raffleReward {
  code: number
  msg: string
  message: string
  data: raffleRewardData
}
interface raffleRewardData {
  raffleId: number
  type: string
  gift_id: string
  gift_name: string
  gift_num: number
  gift_from: string
  gift_type: number
  gift_content: string
  status?: number
}
type raffleAward = raffleReward
/**
 * 抽奖lottery
 *
 * @interface lotteryReward
 */
interface lotteryReward {
  code: number
  msg: string
  message: string
  data: lotteryRewardData
}
interface lotteryRewardData {
  id: number
  type: string
  award_id: string
  award_type: 1 | 2
  time: number
  message: string
  from: string
  privilege_type: 1 | 2 | 3
  award_list: lotteryRewardDataAwardlist[]
}
interface lotteryRewardDataAwardlist {
  name: string
  img: string
  type: number
  content: string
}
/**
 * 节奏跟风返回值
 *
 * @interface joinStorm
 */
interface joinStorm {
  code: number
  message: string
  msg: string
  data: joinStormData
}
interface joinStormData {
  gift_id: number
  title: string
  content: string
  mobile_content: string
  gift_img: string
  gift_num: number
  gift_name: string
}
interface boxDraw {
  code: number
  msg: string
  message: string
  data: any[]
}
interface boxReward {
  code: number
  msg: string
  message: string
  data: any[]
}
export default Raffle
