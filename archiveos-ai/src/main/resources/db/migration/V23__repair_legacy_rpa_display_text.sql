do $$
begin
  if to_regclass('public.archiveos_rpa_tasks') is not null then
    update public.archiveos_rpa_tasks
    set title = 'ArchiveOS 자동화 E2E 검증',
        description = 'RPA 분류, Spring Batch, PM 승인 흐름을 확인하는 통제된 E2E 검증입니다. 외부 실행, 배포, shell 작업은 수행하지 않습니다.'
    where id = 'd656dfbb-408f-4805-9b2e-6dd1dae5140a'::uuid
      and (title like '%?%' or description like '%?%' or description like '%�%');

    update public.archiveos_rpa_tasks
    set title = 'ArchiveOS 자동화 기록 검증',
        description = '4개 핵심 서비스와 ArchiveOS 운영 기록 연결을 확인하는 읽기 전용 자동화 검증입니다.'
    where id = '04798467-455c-4933-a65f-1e07c52d9ec0'::uuid
      and (title like '%?%' or description like '%?%' or description like '%�%');
  end if;

  if to_regclass('public.archiveos_rpa_decisions') is not null then
    update public.archiveos_rpa_decisions
    set reason = '검증 범위와 안전 정책을 확인했습니다. 외부 실행 없이 기록만 승인합니다.'
    where id = '6bb48210-a073-44b6-adfe-6889c732bb7f'::uuid
      and (reason like '%?%' or reason like '%�%');

    update public.archiveos_rpa_decisions
    set reason = '통제된 ArchiveOS 자동화 검증의 범위와 외부 쓰기 차단을 확인했습니다.'
    where id in (
      '092b4c48-f7b3-456c-8e18-26ba257cc005'::uuid,
      '2e279bbf-cfb0-41f6-ace8-00a39dff871b'::uuid
    ) and (reason like '%?%' or reason like '%�%');
  end if;
end $$;
