Pod::Spec.new do |s|
  s.name           = 'VisionSegmentation'
  s.version        = '0.1.0'
  s.summary        = 'On-device person detection and garment segmentation via Apple Vision'
  s.description    = 'Local Expo module wrapping Apple Vision for the scan-to-match feature (research.md §3 on-device path).'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '17.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
