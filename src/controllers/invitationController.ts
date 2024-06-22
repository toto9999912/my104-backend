import { type NextFunction, type Request, type Response } from "express"
import { type LoginResData } from "@/types/login"
import { Invitation } from "@/models/invitation"
import { BeInvitation } from "@/models/beInvitation"
import { Profile } from "@/models/profile"
import { Collection } from "@/models/collection"
import appErrorHandler from "@/utils/appErrorHandler"
import appSuccessHandler from "@/utils/appSuccessHandler"
import { checkPageSizeAndPageNumber } from "@/utils/checkControllerParams"
import { createNotification } from "./notificationsController"
import { isInBlackList } from "@/utils/blackListHandler"
interface ParsedInvitation {
  userId: string
  invitedUserId: string
  message: {
    title: string
    content: string
  }
  id?: string
  profileByInvitedUser: {
    photoDetails: string
    introDetails: string
    nickNameDetails: string
    incomeDetails: string
    lineDetails: string
    tags: string[]
    exposureSettings: string
    userStatus: string
  }
}
// import { eraseProperty } from "@/utils/responseDataHandler"
const postInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { userId } = req.user as LoginResData
  const { invitedUserId, message } = req.body
  if (!invitedUserId) {
    appErrorHandler(400, "缺少邀請使用者Id", next)
  }
  if (userId === invitedUserId) {
    appErrorHandler(400, "不能邀請自己", next)
  }
  if (!message) {
    appErrorHandler(400, "缺少訊息", next)
  }
  if (!message.title) {
    appErrorHandler(400, "缺少標題", next)
  }
  if (!message.content) {
    appErrorHandler(400, "缺少訊息", next)
  }
  if (!userId || !invitedUserId) {
    appErrorHandler(400, "缺少使用者Id", next)
  }
  // 檢查邀約人是否在被邀約人的黑名單中
  if (await isInBlackList(userId, invitedUserId, next)) {
    appErrorHandler(400, "邀請失敗", next)
  }

  const invitation = await Invitation.create({ userId, invitedUserId, message })
  const isNotificationCreated = await createNotification(userId, invitedUserId, message, 1)
  if (!invitation || !isNotificationCreated) {
    appErrorHandler(400, "邀請失敗", next)
  } else {
    if (!invitation.id) {
      appErrorHandler(400, "邀請失敗", next)
    }
    const beInvitation = await BeInvitation.create({ userId, invitedUserId, message, invitationId: invitation.id })
    if (!beInvitation) {
      appErrorHandler(400, "邀請失敗", next)
    } else {
      appSuccessHandler(201, "邀請成功", invitation, res)
    }
  }
}
const getInvitationList = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
  const { pageSize, page, sort } = req.query as { pageSize?: string, page?: string, sort?: string }
  // 檢查是否有傳入pageSize和pageNumber，若無則設定預設值
  const { parsedPageNumber, parsedPageSize } = checkPageSizeAndPageNumber(pageSize, page)
  const dateSort = sort === "desc" ? "-updatedAt" : "updatedAt"
  const { userId } = req.user as LoginResData
  const [profile, collection] = await Promise.all([Profile.findOne({ userId }).select("unlockComment"), Collection.find({ userId }).select("collectedUserId")])
  const unlockComment = profile?.unlockComment ?? []
  const collectionList = collection.map(doc => doc.id.toString()) ?? []
  const [totalCount, invitationList] = await Promise.all([Invitation.countDocuments({ userId }), Invitation.find({ userId }).sort(dateSort).skip((parsedPageNumber - 1) * parsedPageSize).limit(parsedPageSize).populate({
    path: "profileByInvitedUser",
    select: "photoDetails introDetails nickNameDetails incomeDetails lineDetails jobDetails companyDetails tags exposureSettings userStatus"
  }).populate({
    path: "matchListSelfSettingByInvitedUser",
    select: "searchDataBase personalInfo workInfo"
  })])
  // const invitationList = await Invitation.find({ userId }).skip((parsedPageNumber - 1) * parsedPageSize).limit(parsedPageSize).populate({
  //   path: "profileByInvitedUser",
  //   select: "photoDetails introDetails nickNameDetails incomeDetails lineDetails jobDetails companyDetails tags exposureSettings userStatus"
  // }).populate({
  //   path: "matchListSelfSettingByInvitedUser",
  //   select: "searchDataBase personalInfo workInfo"
  // })
  const invitationsLength = await Invitation.countDocuments({ userId })
  if (!invitationList || invitationList.length === 0) {
    appSuccessHandler(200, "沒有邀請", { invitations: [] }, res)
  } else {
    const parseInvitationList = JSON.parse(JSON.stringify(invitationList))
    const invitations: ParsedInvitation[] = parseInvitationList.map((invitation: ParsedInvitation) => {
      let isUnlock = false
      if (unlockComment.length !== 0) {
        isUnlock = unlockComment.includes(invitation.invitedUserId)
      }

      let isCollected = false
      if (collectionList.length !== 0) {
        isCollected = collectionList.includes(invitation.invitedUserId)
      }
      return { ...invitation, isUnlock, isCollected }
    })
    // invitations.forEach((_, i: number) => {
    //   // 會報錯Maximum call stack size exceede
    //   eraseProperty(invitations[i], ["profileByInvitedUser", "nickNameDetails", "photoDetails", "introDetails", "incomeDetails", "lineDetails", "exposureSettings", "userStatus"
    //   ], ["_id"])
    // })
    const pagination = {
      page: parsedPageNumber,
      perPage: parsedPageSize,
      totalCount
    }
    const response = {
      invitations,
      invitationsLength,
      pagination
    }
    appSuccessHandler(200, "查詢成功", response, res)
  }
}
const getInvitationById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params
  const invitation = await Invitation.findById(id).populate({
    path: "profileByInvitedUser",
    select: "photoDetails introDetails nickNameDetails incomeDetails lineDetails jobDetails companyDetails tags exposureSettings userStatus"
  })
  if (!invitation) {
    appErrorHandler(404, "No invitation found", next)
  } else {
    appSuccessHandler(200, "查詢成功", invitation, res)
  }
}

const cancelInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params
  const { userId } = req.user as LoginResData
  const invitation = await Invitation.findByIdAndUpdate(id, { status: "cancel" }, { new: true })

  const beInvitation = await BeInvitation.findOneAndUpdate({ userId, invitationId: id }, { status: "cancel" }, { new: true })
  if (!invitation || !beInvitation) {
    appErrorHandler(404, "No invitation found", next)
  } else {
    appSuccessHandler(200, "取消邀請成功", invitation, res)
  }
}
const deleteInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params
  const invitation = await Invitation.findByIdAndDelete(id)
  const beInvitation = await BeInvitation.findOneAndUpdate({ invitationId: id }, { status: "cancel" }, { new: true })
  if (!invitation || !beInvitation) {
    appErrorHandler(404, "No invitation found", next)
  } else {
    appSuccessHandler(200, "刪除成功", invitation, res)
  }
}
const finishInvitationDating = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params
  const invitation = await Invitation.findByIdAndUpdate(id, { isFinishDating: true, status: "finishDating" }, { new: true })
  if (!invitation) {
    appErrorHandler(404, "No invitation found", next)
  } else {
    appSuccessHandler(200, "已完成約會", invitation, res)
  }
}
export { postInvitation, getInvitationList, getInvitationById, cancelInvitation, deleteInvitation, finishInvitationDating }
