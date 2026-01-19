import { useState } from 'react'
import { Modal, Form, Select, Input, message } from 'antd'
import { createReport, type ReportTargetType } from '../api/reports'
import { getErrorMessage } from '../api/client'

type ReportModalProps = {
  visible: boolean
  onClose: () => void
  targetType: ReportTargetType
  targetId: string
}

const REPORT_REASONS = [
  '垃圾广告',
  '辱骂攻击',
  '色情低俗',
  '政治敏感',
  '违法犯罪',
  '其他',
]

const ReportModal = ({ visible, onClose, targetType, targetId }: ReportModalProps) => {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      
      await createReport({
        target_type: targetType,
        target_id: targetId,
        reason: values.reason,
        detail: values.detail || '',
      })

      message.success('举报已提交，我们会尽快处理')
      form.resetFields()
      onClose()
    } catch (error) {
      if (error instanceof Error && error.name === 'ValidationError') {
         // Form validation failed, do nothing
      } else {
        message.error(getErrorMessage(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      title="举报"
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={submitting}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="reason"
          label="举报理由"
          rules={[{ required: true, message: '请选择举报理由' }]}
        >
          <Select placeholder="请选择">
            {REPORT_REASONS.map((reason) => (
              <Select.Option key={reason} value={reason}>
                {reason}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item
          name="detail"
          label="补充说明 (选填)"
          rules={[{ max: 200, message: '最多 200 字' }]}
        >
          <Input.TextArea placeholder="请填写详细说明..." rows={4} maxLength={200} showCount />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default ReportModal
