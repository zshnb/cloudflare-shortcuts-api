import assert from 'node:assert/strict'
import test from 'node:test'
import {
	buildDownloadUrl,
	extractAwemeId,
	extractDouyinUrl,
	extractVideoId,
} from '../src/douyin-download.ts'

test('extracts a reusable Douyin download URL from share data', () => {
	const sharedContent = '复制打开抖音 https://v.douyin.com/Kn2DKYVTm_s/ 01/25'
	const html = '<script>{"video":{"play_addr":{"uri":"v2800example","url_list":[]}}}</script>'

	assert.equal(extractDouyinUrl(sharedContent)?.hostname, 'v.douyin.com')
	assert.equal(extractDouyinUrl('https://v.douyin.com.evil.test/video/1'), undefined)
	assert.equal(extractAwemeId('/share/video/7666273029680905593/'), '7666273029680905593')
	assert.equal(extractVideoId(html), 'v2800example')
	assert.equal(
		buildDownloadUrl('v2800example'),
		'https://aweme.snssdk.com/aweme/v1/play/?video_id=v2800example&ratio=1080p&line=0',
	)
})
