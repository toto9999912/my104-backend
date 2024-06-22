import { Schema, model } from "mongoose"

interface ITags {
  hashTags: object
}

interface IParams {
  hashTags: ITags
}
const paramsSchema = new Schema<IParams>({
  hashTags: {
    type: Object
  }
}, {
  versionKey: false
})
const Params = model<IParams>("param", paramsSchema)

export { Params, type IParams }

// const hashTags = {
//   value: ["誠實", "公正", "正直", "尊重", "慷慨", "勇敢", "責任感", "寬容", "助人", "合作", "謙虛", "堅韌"],
//   personal: ["樂觀", "幽默", "積極", "溫柔", "細心", "冷靜", "活潑", "耐心", "自信", "謙虛", "大方", "溫和"],
//   zodiac: ["牡羊座", "金牛座", "雙子座", "巨蟹座", "獅子座", "處女座", "天秤座", "天蠍座", "射手座", "摩羯座", "水瓶座", "雙魚座"],
//   hobby: ["讀書", "旅行", "攝影", "烹飪", "電影", "音樂", "登山", "游泳", "花藝", "健身", "瑜伽", "釣魚"],
//   news: ["政治", "經濟", "科技", "環境", "社會", "醫療", "教育", "文化", "運動", "娛樂", "國際", "國內"]
// };
