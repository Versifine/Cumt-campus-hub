import { useEffect, useState } from 'react'
import { Modal, Form, Input, Upload, Button, message, Avatar, Space } from 'antd'
import { UploadOutlined, UserOutlined, PictureOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd/es/upload/interface'
import { uploadInlineImage } from '../api/uploads'
import { updateCurrentUser, type CurrentUser } from '../api/users'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { setStoredUser } from '../store/auth'

type EditProfileModalProps = {
  visible: boolean
  onClose: () => void
  user: CurrentUser | null
  onSuccess: () => void
}

const EditProfileModal = ({ visible, onClose, user, onSuccess }: EditProfileModalProps) => {
  const [form] = Form.useForm()
  const { user: authUser, setUser } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string>('')
  const [coverUrl, setCoverUrl] = useState<string>('')

  // Reset form when user changes or modal opens
  useEffect(() => {
    if (visible && user) {
      form.setFieldsValue({
        nickname: user.nickname,
        bio: user.bio,
      })
      setAvatarUrl(user.avatar || '')
      setCoverUrl(user.cover || '')
    }
  }, [visible, user, form])

  const handleUpload = async (file: File, type: 'avatar' | 'cover') => {
    try {
      const res = await uploadInlineImage(file)
      if (type === 'avatar') {
        setAvatarUrl(res.url)
      } else {
        setCoverUrl(res.url)
      }
      message.success('Upload successful')
    } catch (error) {
      message.error(getErrorMessage(error))
    }
  }

  const uploadProps = (type: 'avatar' | 'cover'): UploadProps => ({
    showUploadList: false,
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/')
      if (!isImage) {
        message.error('You can only upload image files!')
        return Upload.LIST_IGNORE
      }
      handleUpload(file, type)
      return false // Prevent auto upload by antd, handled manually
    },
  })

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      const updated = await updateCurrentUser({
        nickname: values.nickname,
        bio: values.bio,
        avatar: avatarUrl,
        cover: coverUrl,
      })

      if (authUser && authUser.id === updated.id) {
        const nextUser = {
          ...authUser,
          nickname: updated.nickname,
          avatar: updated.avatar,
        }
        setUser(nextUser)
        setStoredUser(nextUser)
      }

      message.success('Profile updated')
      onSuccess()
      onClose()
    } catch (error) {
      if (error instanceof Error && error.name === 'ValidationError') {
        // Form validation failed
      } else {
        message.error(getErrorMessage(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="Edit Profile"
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={submitting}
      destroyOnClose
      width={600}
    >
      <Form form={form} layout="vertical">
        {/* Cover Image Upload */}
        <Form.Item label="Cover Image">
          <div 
            style={{ 
              height: 120, 
              background: coverUrl ? `url(${coverUrl}) center/cover no-repeat` : '#f0f2f5',
              borderRadius: 8,
              position: 'relative',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Upload {...uploadProps('cover')}>
              <Button icon={<PictureOutlined />}>Change Cover</Button>
            </Upload>
          </div>
        </Form.Item>

        {/* Avatar Upload */}
        <Form.Item label="Avatar" style={{ marginBottom: 24 }}>
          <Space align="center" size={16}>
            <Avatar 
              size={64} 
              src={avatarUrl} 
              icon={<UserOutlined />} 
            />
            <Upload {...uploadProps('avatar')}>
              <Button icon={<UploadOutlined />}>Change Avatar</Button>
            </Upload>
          </Space>
        </Form.Item>

        {/* Text Fields */}
        <Form.Item
          name="nickname"
          label="Nickname"
          rules={[{ required: true, message: 'Nickname is required' }, { max: 32 }]}
        >
          <Input placeholder="Your display name" maxLength={32} />
        </Form.Item>

        <Form.Item
          name="bio"
          label="Bio"
          rules={[{ max: 200 }]}
        >
          <Input.TextArea placeholder="Tell us about yourself..." rows={4} maxLength={200} showCount />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default EditProfileModal
