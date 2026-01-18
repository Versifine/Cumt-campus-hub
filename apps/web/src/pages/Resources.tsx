import { useState, type FormEvent } from 'react'
import { 
  Layout, 
  Card, 
  Upload, 
  Button, 
  List, 
  Typography, 
  message, 
  Space,
  Empty
} from 'antd'
import { 
  InboxOutlined, 
  FileTextOutlined, 
  LinkOutlined, 
  DownloadOutlined 
} from '@ant-design/icons'
import SiteHeader from '../components/SiteHeader'
import { uploadFile, type UploadResponse } from '../api/files'
import { getErrorMessage } from '../api/client'
import { formatRelativeTimeUTC8 } from '../utils/time'

const { Content } = Layout
const { Dragger } = Upload
const { Title, Text, Paragraph } = Typography

type UploadItem = UploadResponse & {
  createdAt: string
}

const Resources = () => {
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (options: any) => {
    const { file, onSuccess, onError } = options
    setUploading(true)
    try {
      const result = await uploadFile(file)
      const item: UploadItem = {
        ...result,
        createdAt: new Date().toISOString(),
      }
      setUploads(prev => [item, ...prev])
      message.success('上传成功')
      onSuccess(result)
    } catch (err) {
      const msg = getErrorMessage(err)
      message.error(msg)
      onError(new Error(msg))
    } finally {
      setUploading(false)
    }
  }

  const handleCopy = async (url: string) => {
    const fullUrl = new URL(url, window.location.origin).toString()
    try {
      await navigator.clipboard.writeText(fullUrl)
      message.success('链接已复制')
    } catch {
      message.error('复制失败')
    }
  }

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <SiteHeader />
      <Content style={{ maxWidth: 1000, margin: '24px auto', width: '100%', padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Upload Area */}
          <Card title="上传资源" bordered={false} style={{ height: 'fit-content' }}>
            <Dragger
              customRequest={handleUpload}
              showUploadList={false}
              disabled={uploading}
              style={{ padding: 32 }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                建议上传课件、复习资料或工具文档。单次上传上限 10MB。
              </p>
            </Dragger>
          </Card>

          {/* Recent Uploads */}
          <Card title="最近上传" bordered={false}>
            <List
              dataSource={uploads}
              locale={{ emptyText: <Empty description="暂无上传记录" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
              renderItem={item => (
                <List.Item
                  actions={[
                    <Button 
                      key="open" 
                      type="text" 
                      icon={<DownloadOutlined />} 
                      href={item.url} 
                      target="_blank"
                    >
                      打开
                    </Button>,
                    <Button 
                      key="copy" 
                      type="text" 
                      icon={<LinkOutlined />} 
                      onClick={() => handleCopy(item.url)}
                    >
                      复制链接
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    avatar={<FileTextOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
                    title={
                      <Text ellipsis style={{ maxWidth: 200 }} title={item.filename}>
                        {item.filename}
                      </Text>
                    }
                    description={formatRelativeTimeUTC8(item.createdAt)}
                  />
                </List.Item>
              )}
            />
          </Card>
        </div>
      </Content>
    </Layout>
  )
}

export default Resources
