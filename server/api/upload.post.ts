// 文件上传 API 端点
// 功能：
// - 接收上传的图片/音频文件
// - 将文件保存到 public/uploads 文件夹
// - 返回文件的相对路径，供前端保存到数据库
// 权限：需要登录才能上传文件

import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { getUserFromEventWithSession } from '../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // 鉴权：必须登录才能上传文件
    await getUserFromEventWithSession(event, prisma)

    // 解析 multipart/form-data 请求体
    const formData = await readFormData(event)
    const file = formData.get('file') as File | null
    const folder = formData.get('folder') as string | null // 可选的子文件夹：images / audio / logos

    if (!file) {
      throw createError({
        statusCode: 400,
        message: '未找到上传的文件',
      })
    }

    // 验证文件类型和大小
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    const validAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/x-wav']
    const maxSize = 10 * 1024 * 1024 // 10MB 限制

    if (file.size > maxSize) {
      throw createError({
        statusCode: 400,
        message: '文件大小超过限制（最大10MB）',
      })
    }

    const fileType = file.type
    const isImage = validImageTypes.includes(fileType)
    const isAudio = validAudioTypes.includes(fileType)

    if (!isImage && !isAudio) {
      throw createError({
        statusCode: 400,
        message: '不支持的文件类型（仅支持图片和音频文件）',
      })
    }

    // 确定存储路径
    const rootDir = process.cwd()
    const uploadBaseDir = path.join(rootDir, 'public', 'uploads')
    let targetDir = uploadBaseDir

    // 根据 folder 参数或文件类型确定子文件夹
    if (folder === 'images' || folder === 'logos' || folder === 'audio') {
      targetDir = path.join(uploadBaseDir, folder)
    } else if (isImage) {
      targetDir = path.join(uploadBaseDir, 'images')
    } else if (isAudio) {
      targetDir = path.join(uploadBaseDir, 'audio')
    }

    // 确保目录存在
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    // 生成唯一文件名（避免命名冲突）
    const originalName = file.name || 'upload'
    const ext = path.extname(originalName) || (isImage ? '.png' : '.mp3')
    const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_')
    const timeStamp = Date.now()
    const fileName = `${baseName}_${timeStamp}${ext}`
    const filePath = path.join(targetDir, fileName)

    // 将文件内容转换为 Buffer 并保存
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    fs.writeFileSync(filePath, buffer)

    // 计算相对路径（相对于 public 目录，用于前端访问）
    // 例如：/uploads/images/example_1234567890.png
    const relativePath = path
      .join('uploads', path.relative(uploadBaseDir, filePath))
      .replace(/\\/g, '/') // 确保 Windows 路径也使用正斜杠

    return {
      success: true,
      data: {
        path: `/${relativePath}`, // 返回可直接访问的 URL 路径
        fileName,
        originalName,
        size: file.size,
        type: fileType,
      },
    }
  } catch (error: any) {
    console.error('[Upload API] 文件上传失败:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || error.statusMessage || '文件上传失败',
    })
  }
})
